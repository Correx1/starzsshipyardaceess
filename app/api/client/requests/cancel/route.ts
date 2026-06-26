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

    // 1. Parse and validate request_id
    const { request_id } = await req.json();
    if (!request_id) {
      return NextResponse.json({ error: "Request ID is required for cancellation." }, { status: 400 });
    }

    // 2. Fetch the request to verify ownership and check-in status
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("access_requests")
      .select("id, client_id, status, entered_at")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      console.error("Error fetching request for cancellation:", fetchError);
      return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    }

    // 3. Confirm  client owns this request
    if (request.client_id !== clientSession.id) {
      return NextResponse.json({ error: "Unauthorized. This request belongs to a different workspace." }, { status: 403 });
    }

    // 4. Validate that the ticket can be cancelled
    if (request.status === "cancelled") {
      return NextResponse.json({ error: "This request has already been cancelled." }, { status: 400 });
    }

    if (request.entered_at !== null) {
      return NextResponse.json({ error: "Cannot cancel a ticket that has already checked in at the gate." }, { status: 400 });
    }

    // 5. Update status in database to 'cancelled'
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from("access_requests")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error cancelling request in DB:", updateError);
      return NextResponse.json({ error: "Failed to update cancellation status." }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (err: any) {
    console.error("Client cancel request API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
