/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Helper to check client authentication
async function verifyClientAuth() {
  const cookieStore = await cookies();
  const clientCookie = cookieStore.get("client_session")?.value;

  if (!clientCookie) return null;
  return await verifyClientToken(clientCookie);
}

// Generate unique card number helper: CRD-STZ-XXXX-XX
function generateCardNumber(orgName: string): string {
  const cleanOrg = orgName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "CARD";
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CRD-STZ-${cleanOrg}-${randomSuffix}`;
}

// GET: Fetch all fleet cards for the logged-in client
export async function GET() {
  try {
    const clientSession = await verifyClientAuth();
    if (!clientSession) {
      return NextResponse.json({ error: "Unauthorized. Client session required." }, { status: 401 });
    }

    const { data: cards, error } = await supabaseAdmin
      .from("company_cards")
      .select("id, card_number, client_id, label, pin, status, created_at, updated_at")
      .eq("client_id", clientSession.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching client cards:", error);
      return NextResponse.json({ error: "Failed to retrieve company fleet cards." }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      cards: cards || [],
      org_name: clientSession.org_name 
    });
  } catch (err: any) {
    console.error("Client cards GET error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// POST: Issue a new fleet card for the logged-in client
export async function POST(req: NextRequest) {
  try {
    const clientSession = await verifyClientAuth();
    if (!clientSession) {
      return NextResponse.json({ error: "Unauthorized. Client session required." }, { status: 401 });
    }

    const { label, pin } = await req.json();

    // Generate or validate PIN (4 numeric digits)
    let cardPin = pin ? pin.toString().trim() : "";
    if (!cardPin) {
      cardPin = Math.floor(1000 + Math.random() * 9000).toString();
    } else if (!/^\d{4}$/.test(cardPin)) {
      return NextResponse.json({ error: "Card PIN must be exactly 4 numeric digits." }, { status: 400 });
    }

    const finalCardNumber = generateCardNumber(clientSession.org_name);
    const cardLabel = label?.trim() || "Fleet Vehicle Card";

    const { data: newCard, error: insertError } = await supabaseAdmin
      .from("company_cards")
      .insert([
        {
          card_number: finalCardNumber,
          client_id: clientSession.id,
          label: cardLabel,
          pin: cardPin,
          status: "active",
        },
      ])
      .select("id, card_number, client_id, label, pin, status, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("Error creating client fleet card:", insertError);
      return NextResponse.json({ error: "Failed to create company fleet card." }, { status: 500 });
    }

    return NextResponse.json({ success: true, card: newCard });
  } catch (err: any) {
    console.error("Client cards POST error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// PUT: Update card label, PIN, or freeze/unfreeze status
export async function PUT(req: NextRequest) {
  try {
    const clientSession = await verifyClientAuth();
    if (!clientSession) {
      return NextResponse.json({ error: "Unauthorized. Client session required." }, { status: 401 });
    }

    const { id, label, pin, status } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Card ID is required." }, { status: 400 });
    }

    // Verify the card belongs to this client
    const { data: existingCard, error: checkError } = await supabaseAdmin
      .from("company_cards")
      .select("id, client_id, status")
      .eq("id", id)
      .eq("client_id", clientSession.id)
      .single();

    if (checkError || !existingCard) {
      return NextResponse.json({ error: "Card not found or access denied." }, { status: 404 });
    }

    if (existingCard.status === "revoked") {
      return NextResponse.json({ error: "Revoked cards cannot be modified. Contact Gate Admin." }, { status: 400 });
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
      if (!["active", "frozen"].includes(status)) {
        return NextResponse.json({ error: "Clients can only set card status to active or frozen." }, { status: 400 });
      }
      updatePayload.status = status;
    }

    const { data: updatedCard, error: updateError } = await supabaseAdmin
      .from("company_cards")
      .update(updatePayload)
      .eq("id", id)
      .eq("client_id", clientSession.id)
      .select("id, card_number, client_id, label, pin, status, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("Error updating client card:", updateError);
      return NextResponse.json({ error: "Failed to update fleet card." }, { status: 500 });
    }

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (err: any) {
    console.error("Client cards PUT error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
