import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { getRescheduledEmailTemplate } from "@/lib/emailTemplates";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const clientCookie = cookieStore.get("client_session")?.value;

    if (!clientCookie) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const clientSession = await verifyClientToken(clientCookie);
    if (!clientSession) {
      return NextResponse.json({ error: "Unauthorized. Session is invalid." }, { status: 401 });
    }

    // 1. Parse and validate parameters
    const { request_id, new_date } = await req.json();

    if (!request_id) {
      return NextResponse.json({ error: "Request ID is required for rescheduling." }, { status: 400 });
    }

    if (!new_date) {
      return NextResponse.json({ error: "New expected date is required." }, { status: 400 });
    }

    // 2. Fetch the request joined with client info
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("access_requests")
      .select(`
        *,
        clients (
          org_name
        )
      `)
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      console.error("Error fetching request for reschedule:", fetchError);
      return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    }

    // 3. Confirm B2B client ownership
    if (request.client_id !== clientSession.id) {
      return NextResponse.json({ error: "Unauthorized. This request belongs to a different workspace." }, { status: 403 });
    }

    // 4. Validate check-in status
    if (request.entered_at !== null) {
      return NextResponse.json({ error: "Cannot reschedule a pass that has already checked in at the gate." }, { status: 400 });
    }

    const oldDate = request.expected_date;

    // 5. Update expected_date and last_rescheduled_at in database
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from("access_requests")
      .update({
        expected_date: new_date,
        last_rescheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating reschedule date in DB:", updateError);
      return NextResponse.json({ error: "Failed to update entry pass date." }, { status: 500 });
    }

    // 6. Notify Administrator of the reschedule change
    try {
      const { data: adminSettings } = await supabaseAdmin
        .from("admin_settings")
        .select("value")
        .eq("key", "admin_notification_emails")
        .single();

      const adminEmails = adminSettings?.value?.trim();
      if (adminEmails) {
        const clientOrgName = request.clients?.org_name || "B2B Partner";
        const emailHtml = getRescheduledEmailTemplate({
          ticketNumber: request.ticket_number,
          clientOrgName,
          visitorName: request.visitor_name,
          visitorPhone: request.visitor_phone,
          oldDate,
          newDate: new_date,
          domainUrl: req.nextUrl.origin,
        });

        const recipients = adminEmails.split(",").map((email: string) => email.trim()).filter(Boolean);
        for (const email of recipients) {
          try {
            await sendEmail({
              to: email,
              subject: `Ticket Rescheduled - ${clientOrgName} (${request.ticket_number})`,
              html: emailHtml,
            });
          } catch (err) {
            console.error(`Failed to send reschedule notification to admin: ${email}`, err);
          }
        }
      }
    } catch (notifyErr) {
      console.error("Failed to dispatch reschedule email notifications:", notifyErr);
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (err: any) {
    console.error("Client reschedule request API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
