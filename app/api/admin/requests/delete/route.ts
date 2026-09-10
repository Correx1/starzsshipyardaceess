import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const session = await verifyAdminToken(token);
    if (!session) {
      return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });
    }

    const { id, request_id } = await req.json();
    const targetId = id || request_id;

    if (!targetId) {
      return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
    }

    // Soft delete the access request
    const { error: updateError } = await supabaseAdmin
      .from("access_requests")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", targetId);

    if (updateError) {
      // If column is_deleted does not exist yet, fallback to status updated or soft deletion flag
      console.error("Error soft deleting request:", updateError);
      return NextResponse.json({ error: "Failed to delete request." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Request successfully deleted." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req);
}
