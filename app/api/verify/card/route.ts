/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { card_number, pin } = await req.json();

    const cleanCardNumber = card_number?.trim()?.toUpperCase();
    const cleanPin = pin?.toString()?.trim();

    if (!cleanCardNumber) {
      return NextResponse.json({ error: "Card number is required." }, { status: 400 });
    }

    if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      return NextResponse.json({ error: "Please enter a valid 4-digit numeric Card PIN." }, { status: 400 });
    }

    // 1. Fetch card details with client org
    const { data: card, error: cardError } = await supabaseAdmin
      .from("company_cards")
      .select(`
        id,
        card_number,
        client_id,
        label,
        pin,
        status,
        clients (
          id,
          org_name
        )
      `)
      .ilike("card_number", cleanCardNumber)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: "Invalid Company Card. Card number is not registered." }, { status: 404 });
    }

    // 2. Check card status
    if (card.status === "frozen") {
      return NextResponse.json({
        error: "This card is temporarily FROZEN by company administration. Access denied.",
      }, { status: 403 });
    }

    if (card.status === "revoked") {
      return NextResponse.json({
        error: "This card has been REVOKED by Shipyard Security. Access denied.",
      }, { status: 403 });
    }

    // 3. Verify PIN
    if (card.pin !== cleanPin) {
      return NextResponse.json({
        error: "Incorrect 4-digit PIN for this card. Access denied.",
      }, { status: 401 });
    }

    // 4. Determine today's date in Nigeria / WAT timezone (UTC+1)
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayStr = formatter.format(new Date()); // "YYYY-MM-DD"

    // 5. Query approved access requests for this sister company for today
    const { data: requests, error: reqError } = await supabaseAdmin
      .from("access_requests")
      .select(`
        id,
        ticket_number,
        pin_code,
        visitor_name,
        visitor_phone,
        visitor_email,
        resources,
        expected_date,
        status,
        denial_reason,
        entered_at,
        entered_by,
        exited_at,
        exited_by,
        requesting_staff_name,
        requesting_staff_email,
        created_at
      `)
      .eq("client_id", card.client_id)
      .eq("expected_date", todayStr)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (reqError) {
      console.error("Error fetching card access requests:", reqError);
      return NextResponse.json({ error: "Database error retrieving company trips." }, { status: 500 });
    }

    const clientOrgName = (card.clients as any)?.org_name || "Sister Company";

    return NextResponse.json({
      success: true,
      card: {
        card_number: card.card_number,
        label: card.label,
        client_org_name: clientOrgName,
      },
      requests: requests || [],
      date: todayStr,
    });
  } catch (err: any) {
    console.error("Gate card verification error:", err);
    return NextResponse.json({ error: "An unexpected error occurred during card lookup." }, { status: 500 });
  }
}
