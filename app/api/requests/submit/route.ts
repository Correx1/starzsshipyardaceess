import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSecureTicketNumber } from "@/lib/ticket";
import { sendWhatsAppMessage } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const { token, visitor_name, visitor_email, visitor_phone, expected_date, machineries } = await req.json();

    // 1. Basic field validations
    if (!token?.trim()) {
      return NextResponse.json({ error: "Access token is missing." }, { status: 400 });
    }
    if (!visitor_name?.trim() || !visitor_phone?.trim()) {
      return NextResponse.json({ error: "Visitor name and phone are required." }, { status: 400 });
    }
    if (!expected_date) {
      return NextResponse.json({ error: "Expected date of entry is required." }, { status: 400 });
    }
    if (!Array.isArray(machineries) || machineries.length === 0) {
      return NextResponse.json({ error: "At least one machinery must be specified." }, { status: 400 });
    }

    // 2. Validate that the form token is active
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("form_tokens")
      .select("token")
      .eq("token", token.trim())
      .eq("is_active", true)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: "This registration link has expired or is invalid. Please contact the administrator." },
        { status: 400 }
      );
    }

    // 3. Generate a secure, unguessable ticket number
    const ticketNumber = generateSecureTicketNumber();

    // 4. Save access request to Supabase
    const { data: requestData, error: insertError } = await supabaseAdmin
      .from("access_requests")
      .insert([
        {
          ticket_number: ticketNumber,
          visitor_name: visitor_name.trim(),
          visitor_phone: visitor_phone.trim(),
          machineries,
          expected_date,
          status: "pending",
          form_token_used: token.trim(),
        },
      ])
      .select()
      .single();

    if (insertError || !requestData) {
      console.error("Error inserting access request:", insertError);
      return NextResponse.json({ error: "Failed to submit access request. Please try again." }, { status: 500 });
    }

    // 5. Notify the facility owner via WhatsApp
    try {
      const { data: ownerSetting } = await supabaseAdmin
        .from("admin_settings")
        .select("value")
        .eq("key", "owner_whatsapp")
        .single();

      if (ownerSetting?.value) {
        const domainUrl = req.nextUrl.origin;
        const machineryBulletList = machineries.map((m: string) => `  - ${m}`).join("\n");
        
        const ownerMessage = `📥 *NEW ACCESS REQUEST SUBMITTED* 📥\n\n• *From:* ${visitor_name.trim()}\n• *Date:* ${expected_date}\n• *Machinery:*\n${machineryBulletList}\n\nClick here to review: ${domainUrl}/dashboard`;

        await sendWhatsAppMessage(ownerSetting.value, ownerMessage);
      }
    } catch (notifyErr) {
      // Log notification failures but don't crash the form submission transaction!
      console.error("Failed to dispatch owner WhatsApp alert:", notifyErr);
    }

    return NextResponse.json({
      success: true,
      ticket_number: ticketNumber,
      expected_date,
    });
  } catch (err: any) {
    console.error("Form submit API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred during submission." }, { status: 500 });
  }
}
