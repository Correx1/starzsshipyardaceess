import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

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

    // 1. Parse and validate payload
    const { notification_emails } = await req.json();

    if (!Array.isArray(notification_emails)) {
      return NextResponse.json({ error: "Notification emails must be an array." }, { status: 400 });
    }

    if (notification_emails.length > 2) {
      return NextResponse.json({ error: "You can configure a maximum of 2 redundant CC emails." }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmails = [];
    for (const email of notification_emails) {
      const trimmed = email?.trim()?.toLowerCase();
      if (!trimmed) continue;
      if (!emailRegex.test(trimmed)) {
        return NextResponse.json({ error: `Invalid email address format: ${email}` }, { status: 400 });
      }
      cleanEmails.push(trimmed);
    }

    // 2. Update notification_emails field in database
    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({
        notification_emails: cleanEmails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientSession.id);

    if (updateError) {
      console.error("Error updating client notification emails:", updateError);
      return NextResponse.json({ error: "Failed to update notification settings." }, { status: 500 });
    }

    return NextResponse.json({ success: true, notification_emails: cleanEmails });
  } catch (err: any) {
    console.error("Client notification emails API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
