import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decodeTicketSlug } from "@/lib/slug";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Pass number or 6-digit PIN is required." }, { status: 400 });
    }

    const cleanQuery = query.trim();
    const decodedQuery = decodeTicketSlug(cleanQuery);

    const selectQuery = `
      *,
      clients (
        org_name
      )
    `;

    let foundTicket: any = null;

    // 1. If 6-digit numeric PIN
    if (/^\d{6}$/.test(decodedQuery)) {
      const { data, error } = await supabaseAdmin
        .from("access_requests")
        .select(selectQuery)
        .eq("pin_code", decodedQuery)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        foundTicket = data;
      }
    }

    // 2. Query by ticket_number (case-insensitive) or UUID id if not found by PIN
    if (!foundTicket) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedQuery);

      let dbQuery = supabaseAdmin
        .from("access_requests")
        .select(selectQuery);

      if (isUuid) {
        dbQuery = dbQuery.or(`ticket_number.ilike.${decodedQuery},id.eq.${decodedQuery}`);
      } else {
        dbQuery = dbQuery.or(`ticket_number.ilike.${decodedQuery},ticket_number.ilike.${cleanQuery}`);
      }

      const { data, error } = await dbQuery.limit(1).single();

      if (!error && data) {
        foundTicket = data;
      } else {
        // Also try stripping hyphens or dots if user typed STYD-1234 instead of STYD.1234
        const alternate = cleanQuery.replace(/-/g, ".").replace(/\s+/g, "");
        const { data: altData } = await supabaseAdmin
          .from("access_requests")
          .select(selectQuery)
          .ilike("ticket_number", alternate)
          .limit(1)
          .single();

        if (altData) {
          foundTicket = altData;
        }
      }
    }

    if (!foundTicket) {
      return NextResponse.json({ error: "No entry pass found matching " + cleanQuery }, { status: 404 });
    }

    const clientOrgName = foundTicket.clients?.org_name || "Partner Client";

    return NextResponse.json({
      ticket_number: foundTicket.ticket_number,
      clientOrgName,
      ticket: {
        id: foundTicket.id,
        ticket_number: foundTicket.ticket_number,
        pin_code: foundTicket.pin_code,
        visitor_name: foundTicket.visitor_name,
        visitor_email: foundTicket.visitor_email,
        visitor_phone: foundTicket.visitor_phone,
        resources: Array.isArray(foundTicket.resources) ? foundTicket.resources : [],
        expected_date: foundTicket.expected_date,
        status: foundTicket.status,
        denial_reason: foundTicket.denial_reason,
        entered_at: foundTicket.entered_at,
        exited_at: foundTicket.exited_at,
        entered_by: foundTicket.entered_by,
        exited_by: foundTicket.exited_by,
        requesting_staff_name: foundTicket.requesting_staff_name,
        requesting_staff_email: foundTicket.requesting_staff_email,
      },
    });
  } catch (err: any) {
    console.error("Ticket lookup error:", err);
    return NextResponse.json({ error: "Failed to query gate pass." }, { status: 500 });
  }
}
