import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { request_id, guard_code } = await req.json();

    if (!request_id) {
      return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
    }

    if (!guard_code?.trim()) {
      return NextResponse.json({ error: "Security Guard authorization code is required to check out." }, { status: 400 });
    }

    // 1. Verify Security Guard code
    const { data: guard, error: guardError } = await supabaseAdmin
      .from("security_guards")
      .select("name, status")
      .eq("code", guard_code.trim())
      .single();

    if (guardError || !guard) {
      return NextResponse.json({ error: "Invalid Security Guard authorization code." }, { status: 403 });
    }

    if (guard.status !== "active") {
      return NextResponse.json({ error: "This Security Guard account is currently inactive." }, { status: 403 });
    }

    // 2. Fetch current ticket status to verify lifecycle state
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("access_requests")
      .select("id, status, entered_at, exited_at")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      console.error("Error fetching request for check-out:", fetchError);
      return NextResponse.json({ error: "Access request not found." }, { status: 404 });
    }

    // 3. Validate lifecycle constraints
    if (request.status !== "approved") {
      return NextResponse.json({ error: `Cannot check out. Ticket status is: ${request.status}` }, { status: 400 });
    }

    if (request.entered_at === null) {
      return NextResponse.json({ error: "Cannot check out. Visitor has not checked in yet." }, { status: 400 });
    }

    if (request.exited_at !== null) {
      return NextResponse.json({ error: "Ticket has already been checked out and is fully expired." }, { status: 400 });
    }

    // 4. Log check-out timestamp and auditing guard name
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from("access_requests")
      .update({
        exited_at: new Date().toISOString(),
        exited_by: guard.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error logging check-out:", updateError);
      return NextResponse.json({ error: "Failed to log check-out timestamp." }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (err: any) {
    console.error("Check-out API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
