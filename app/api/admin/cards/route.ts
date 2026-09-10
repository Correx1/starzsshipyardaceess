/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Helper to check admin authentication
async function verifyAdminAuth() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_session")?.value;

  if (!adminCookie) return null;
  return await verifyAdminToken(adminCookie);
}

// Generate unique card number helper: CRD-STZ-XXXX-XX
function generateCardNumber(orgName: string): string {
  const cleanOrg = orgName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "CARD";
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CRD-STZ-${cleanOrg}-${randomSuffix}`;
}

// GET: Fetch all company fleet cards
export async function GET() {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { data: cards, error } = await supabaseAdmin
      .from("company_cards")
      .select(`
        id,
        card_number,
        client_id,
        label,
        pin,
        status,
        created_at,
        updated_at,
        clients (
          id,
          org_name,
          username
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching company cards:", error);
      return NextResponse.json({ error: "Failed to retrieve company cards." }, { status: 500 });
    }

    return NextResponse.json({ success: true, cards: cards || [] });
  } catch (err: any) {
    console.error("Admin cards GET error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// POST: Issue a new company fleet card
export async function POST(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { client_id, label, pin, card_number } = await req.json();

    if (!client_id) {
      return NextResponse.json({ error: "Company / Client ID is required." }, { status: 400 });
    }

    // Verify client exists
    const { data: clientData, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, org_name")
      .eq("id", client_id)
      .single();

    if (clientErr || !clientData) {
      return NextResponse.json({ error: "Selected sister company client does not exist." }, { status: 404 });
    }

    // Generate or validate PIN (4 numeric digits)
    let cardPin = pin ? pin.toString().trim() : "";
    if (!cardPin) {
      cardPin = Math.floor(1000 + Math.random() * 9000).toString();
    } else if (!/^\d{4}$/.test(cardPin)) {
      return NextResponse.json({ error: "Card PIN must be exactly 4 numeric digits." }, { status: 400 });
    }

    // Generate or validate card number
    let finalCardNumber = card_number ? card_number.trim().toUpperCase() : "";
    if (!finalCardNumber) {
      finalCardNumber = generateCardNumber(clientData.org_name);
    }

    const cardLabel = label?.trim() || "Fleet Vehicle Card";

    const { data: newCard, error: insertError } = await supabaseAdmin
      .from("company_cards")
      .insert([
        {
          card_number: finalCardNumber,
          client_id,
          label: cardLabel,
          pin: cardPin,
          status: "active",
        },
      ])
      .select(`
        id,
        card_number,
        client_id,
        label,
        pin,
        status,
        created_at,
        updated_at,
        clients (
          id,
          org_name,
          username
        )
      `)
      .single();

    if (insertError) {
      console.error("Error creating company card:", insertError);
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Card number already exists. Please generate a new one." }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to issue company card." }, { status: 500 });
    }

    return NextResponse.json({ success: true, card: newCard });
  } catch (err: any) {
    console.error("Admin cards POST error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// PUT: Update card label, PIN, or status
export async function PUT(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { id, label, pin, status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Card ID is required." }, { status: 400 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (label !== undefined && label.trim()) {
      updatePayload.label = label.trim();
    }

    if (pin !== undefined && pin !== "") {
      const cleanPin = pin.toString().trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        return NextResponse.json({ error: "Card PIN must be exactly 4 numeric digits." }, { status: 400 });
      }
      updatePayload.pin = cleanPin;
    }

    if (status) {
      if (!["active", "frozen", "revoked"].includes(status)) {
        return NextResponse.json({ error: "Invalid status value. Allowed: active, frozen, revoked." }, { status: 400 });
      }
      updatePayload.status = status;
    }

    const { data: updatedCard, error: updateError } = await supabaseAdmin
      .from("company_cards")
      .update(updatePayload)
      .eq("id", id)
      .select(`
        id,
        card_number,
        client_id,
        label,
        pin,
        status,
        created_at,
        updated_at,
        clients (
          id,
          org_name,
          username
        )
      `)
      .single();

    if (updateError) {
      console.error("Error updating company card:", updateError);
      return NextResponse.json({ error: "Failed to update company card." }, { status: 500 });
    }

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (err: any) {
    console.error("Admin cards PUT error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// DELETE: Delete a company card
export async function DELETE(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Card ID is required for deletion." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("company_cards")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting company card:", error);
      return NextResponse.json({ error: "Failed to delete company card." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin cards DELETE error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
