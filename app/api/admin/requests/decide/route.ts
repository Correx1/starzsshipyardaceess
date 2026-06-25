import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { getApprovedEmailTemplate, getDeniedEmailTemplate } from "@/lib/emailTemplates";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Admin Authentication
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("admin_session")?.value;

    if (!adminCookie) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const adminSession = await verifyAdminToken(adminCookie);
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Session is invalid." }, { status: 401 });
    }

    // 2. Parse and validate decision inputs
    const { request_id, status, denial_reason } = await req.json();

    if (!request_id) {
      return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
    }
    if (!["approved", "denied"].includes(status)) {
      return NextResponse.json({ error: "Invalid status decision." }, { status: 400 });
    }
    if (status === "denied" && !denial_reason?.trim()) {
      return NextResponse.json({ error: "A reason must be provided for denials." }, { status: 400 });
    }

    // 3. Fetch request details joined with client information
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("access_requests")
      .select(`
        *,
        clients (
          org_name,
          username,
          notification_emails
        )
      `)
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      console.error("Error fetching request details for decision:", fetchError);
      return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    }

    // 4. Update status in database
    const { error: updateError } = await supabaseAdmin
      .from("access_requests")
      .update({
        status,
        denial_reason: status === "denied" ? denial_reason.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateError) {
      console.error("Error updating request status:", updateError);
      return NextResponse.json({ error: "Failed to save approval decision." }, { status: 500 });
    }

    // 5. Gather notification recipients & signatures
    const domainUrl = req.nextUrl.origin;
    const clientInfo = request.clients;
    const clientOrgName = clientInfo ? clientInfo.org_name : "B2B Client Partner";
    
    // Fetch admin signature details from admin_settings
    let sigName = "";
    let sigPhone = "";
    let sigCompany = "";
    try {
      const { data: sigSettings } = await supabaseAdmin
        .from("admin_settings")
        .select("key, value")
        .in("key", ["admin_signature_name", "admin_signature_phone", "admin_signature_company"]);

      if (sigSettings) {
        sigSettings.forEach((setting: any) => {
          if (setting.key === "admin_signature_name") sigName = setting.value;
          if (setting.key === "admin_signature_phone") sigPhone = setting.value;
          if (setting.key === "admin_signature_company") sigCompany = setting.value;
        });
      }
    } catch (sigErr) {
      console.error("Error loading admin signature settings:", sigErr);
    }
    
    const recipients: string[] = [];
    
    // Smart Email Routing:
    // If requesting staff email is provided, send it to them.
    // Otherwise, fallback to B2B client's default organization account email.
    const staffEmail = request.requesting_staff_email?.trim()?.toLowerCase();
    if (staffEmail && staffEmail.includes("@")) {
      recipients.push(staffEmail);
    } else if (clientInfo && clientInfo.username) {
      recipients.push(clientInfo.username.trim().toLowerCase());
    }

    // 6. Compile and send HTML emails via Resend
    if (status === "approved") {
      const emailHtml = getApprovedEmailTemplate({
        ticketNumber: request.ticket_number,
        pinCode: request.pin_code,
        clientOrgName,
        visitorName: request.visitor_name,
        visitorEmail: request.visitor_email,
        visitorPhone: request.visitor_phone,
        expectedDate: request.expected_date,
        resources: Array.isArray(request.resources) ? request.resources : [],
        domainUrl,
        requestingStaffName: request.requesting_staff_name,
        requestingStaffEmail: request.requesting_staff_email,
        adminSignatureName: sigName,
        adminSignaturePhone: sigPhone,
        adminSignatureCompany: sigCompany,
      });

      // Send to all unique recipients in parallel/sequence
      for (const email of recipients) {
        try {
          await sendEmail({
            to: email,
            subject: `Access Pass APPROVED - Ticket: ${request.ticket_number}`,
            html: emailHtml,
          });
        } catch (err) {
          console.error(`Failed to send approval email to: ${email}`, err);
        }
      }
    } else if (status === "denied") {
      const emailHtml = getDeniedEmailTemplate({
        ticketNumber: request.ticket_number,
        clientOrgName,
        visitorName: request.visitor_name,
        visitorEmail: request.visitor_email,
        visitorPhone: request.visitor_phone,
        expectedDate: request.expected_date,
        denialReason: denial_reason.trim(),
        domainUrl,
        resources: Array.isArray(request.resources) ? request.resources : [],
        requestingStaffName: request.requesting_staff_name,
        requestingStaffEmail: request.requesting_staff_email,
        adminSignatureName: sigName,
        adminSignaturePhone: sigPhone,
        adminSignatureCompany: sigCompany,
      });

      for (const email of recipients) {
        try {
          await sendEmail({
            to: email,
            subject: `Access Request DECLINED - Ref: ${request.ticket_number}`,
            html: emailHtml,
          });
        } catch (err) {
          console.error(`Failed to send denial email to: ${email}`, err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin request decision POST API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
