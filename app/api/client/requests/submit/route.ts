import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";

function generateTicketNumber(): string {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const alphaNum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 8; i++) {
    part1 += alpha.charAt(Math.floor(Math.random() * alpha.length));
    part2 += alphaNum.charAt(Math.floor(Math.random() * alphaNum.length));
  }
  return `STYD.${part1}-${part2}`;
}

function generatePinCode(): string {
  let pin = "";
  for (let i = 0; i < 6; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}

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

    // 1. Fetch current client status in DB to prevent restricted clients from bypasses
    const { data: clientDb, error: clientFetchError } = await supabaseAdmin
      .from("clients")
      .select("id, org_name, status")
      .eq("id", clientSession.id)
      .single();

    if (clientFetchError || !clientDb) {
      return NextResponse.json({ error: "Client account not found." }, { status: 404 });
    }

    if (clientDb.status === "suspended") {
      return NextResponse.json({ error: "Your account is suspended." }, { status: 403 });
    }

    if (clientDb.status === "restricted") {
      return NextResponse.json({ error: "Your account is restricted. Submissions are disabled." }, { status: 403 });
    }

    // 2. Parse and validate request payload
    const { visitor_name, visitor_email, visitor_phone, expected_date, resources, requesting_staff_name, requesting_staff_email } = await req.json();

    if (!requesting_staff_name?.trim()) {
      return NextResponse.json({ error: "Requesting staff name is required." }, { status: 400 });
    }

    if (!visitor_name?.trim() || !visitor_phone?.trim()) {
      return NextResponse.json({ error: "Driver contact details (name and phone) are required." }, { status: 400 });
    }

    if (!expected_date) {
      return NextResponse.json({ error: "Expected arrival date is required." }, { status: 400 });
    }

    if (!Array.isArray(resources) || resources.length === 0) {
      return NextResponse.json({ error: "At least one resource is required in the checklist." }, { status: 400 });
    }

    // 3. Generate unique Ticket Number and 6-digit PIN (verifying uniqueness)
    let ticketNumber = "";
    let pinCode = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      ticketNumber = generateTicketNumber();
      pinCode = generatePinCode();
      attempts++;

      const { data: existing } = await supabaseAdmin
        .from("access_requests")
        .select("id")
        .or(`ticket_number.eq.${ticketNumber},pin_code.eq.${pinCode}`)
        .limit(1);

      if (!existing || existing.length === 0) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return NextResponse.json({ error: "Failed to generate unique ticket credentials. Please try again." }, { status: 500 });
    }

    // 4. Save request to database
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("access_requests")
      .insert([
        {
          ticket_number: ticketNumber,
          pin_code: pinCode,
          client_id: clientDb.id,
          visitor_name: visitor_name.trim(),
          visitor_phone: visitor_phone.trim(),
          resources,
          expected_date,
          status: "pending",
          requesting_staff_name: requesting_staff_name.trim(),
          requesting_staff_email: requesting_staff_email?.trim() || null,
        },
      ])
      .select()
      .single();

    if (insertError || !newRequest) {
      console.error("Error inserting access request:", insertError);
      return NextResponse.json({ error: "Failed to submit request to database." }, { status: 500 });
    }

    // 5. Dispatch Email Alert to Admin (if configured)
    const { data: adminSettings } = await supabaseAdmin
      .from("admin_settings")
      .select("value")
      .eq("key", "admin_notification_emails")
      .single();

    const adminEmails = adminSettings?.value?.trim();
    if (adminEmails) {
      // Build checklist HTML for email
      const checklistHtml = resources
        .map((item: any) => {
          return `<li style="margin: 4px 0; font-family: sans-serif; font-size: 13px; color: #334155;">
            <strong style="text-transform: uppercase; font-size: 10px; background-color: #f1f5f9; padding: 2px 6px; border-radius: 2px; border: 1px solid #e2e8f0; color: #475569;">${item.category}</strong> 
            ${item.quantity}x ${item.type} ${item.details ? `(${item.details})` : ""}
          </li>`;
        })
        .join("");

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>New Facility Access Request</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: sans-serif;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td style="background-color: #001d3f; padding: 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.4;">STARZS MARINE AND ENGINEERING LTD ACCESS CONTROL</h1>
                  <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">NEW ACCESS REGISTRATION PENDING</p>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 30px 24px;">
                  <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.5;">
                    A new facility entry request has been submitted by  Client <strong>${clientDb.org_name}</strong> and is awaiting your decision.
                  </p>
                  
                  <!-- Request Info -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                    <tr>
                      <td width="35%" style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 10px;">Originating Client:</td>
                      <td width="65%" style="font-size: 13px; color: #0f172a; font-weight: 700; padding-bottom: 10px;">${clientDb.org_name}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 10px;">Requesting Staff:</td>
                      <td style="font-size: 13px; color: #0f172a; font-weight: 600; padding-bottom: 10px;">
                        ${newRequest.requesting_staff_name}
                        ${newRequest.requesting_staff_email ? `<span style="font-size: 11px; color: #64748b; font-weight: normal;">(${newRequest.requesting_staff_email})</span>` : ""}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 10px;">Driver / Visitor:</td>
                      <td style="font-size: 13px; color: #0f172a; font-weight: 600; padding-bottom: 10px;">${newRequest.visitor_name}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 10px;">Expected Arrival:</td>
                      <td style="font-size: 13px; color: #001d3f; font-weight: 700; padding-bottom: 10px;">${newRequest.expected_date}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 10px;">Ticket / PIN:</td>
                      <td style="font-size: 13px; color: #0f172a; font-family: monospace; padding-bottom: 10px;">${newRequest.ticket_number} (PIN: ${newRequest.pin_code})</td>
                    </tr>
                  </table>
                  
                  <!-- Checklist -->
                  <div style="margin-bottom: 24px;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">Requested Resource Checklist:</span>
                    <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px 16px;">
                      <ul style="margin: 0; padding: 0; list-style-type: none;">
                        ${checklistHtml}
                      </ul>
                    </div>
                  </div>
                  
                  <!-- Action Link -->
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${req.nextUrl.origin}/dashboard" style="display: inline-block; background-color: #04356a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Open Admin Dashboard</a>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
                  <p style="margin: 0; color: #64748b; font-size: 11px;">
                    This is an automated security notification. Decisions must be processed through the admin dashboard.
                  </p>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      // Split comma separated emails
      const recipients = adminEmails.split(",").map((email: string) => email.trim()).filter(Boolean);
      for (const email of recipients) {
        try {
          await sendEmail({
            to: email,
            subject: `Pending Access Approval - ${clientDb.org_name}`,
            html: emailHtml,
          });
        } catch (err) {
          console.error(`Failed to send alert email to admin recipient (${email}):`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ticket_number: newRequest.ticket_number,
      pin_code: newRequest.pin_code,
    });
  } catch (err: any) {
    console.error("Client requests submit API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
