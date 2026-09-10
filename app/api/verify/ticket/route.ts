import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Pass number or 6-digit PIN is required." }, { status: 400 });
    }

    const cleanQuery = query.trim();

    // 1. If 6-digit numeric PIN
    if (/^\d{6}$/.test(cleanQuery)) {
      const { data, error } = await supabaseAdmin
        .from("access_requests")
        .select("ticket_number, pin_code, status")
        .eq("pin_code", cleanQuery)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "No entry pass found matching PIN " + cleanQuery }, { status: 404 });
      }

      return NextResponse.json({ ticket_number: data.ticket_number });
    }

    // 2. Query by ticket_number (case-insensitive) or UUID id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);

    let dbQuery = supabaseAdmin
      .from("access_requests")
      .select("ticket_number, pin_code, status");

    if (isUuid) {
      dbQuery = dbQuery.or(`ticket_number.ilike.${cleanQuery},id.eq.${cleanQuery}`);
    } else {
      dbQuery = dbQuery.ilike("ticket_number", cleanQuery);
    }

    const { data, error } = await dbQuery.limit(1).single();

    if (error || !data) {
      // Also try stripping hyphens or dots if user typed STYD-1234 instead of STYD.1234
      const alternate = cleanQuery.replace(/-/g, ".").replace(/\s+/g, "");
      const { data: altData } = await supabaseAdmin
        .from("access_requests")
        .select("ticket_number")
        .ilike("ticket_number", alternate)
        .limit(1)
        .single();

      if (altData) {
        return NextResponse.json({ ticket_number: altData.ticket_number });
      }

      return NextResponse.json({ error: "No entry pass found for " + cleanQuery }, { status: 404 });
    }

    return NextResponse.json({ ticket_number: data.ticket_number });
  } catch (err: any) {
    console.error("Ticket lookup error:", err);
    return NextResponse.json({ error: "Failed to query gate pass." }, { status: 500 });
  }
}
