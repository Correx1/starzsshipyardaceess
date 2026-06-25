import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hashPassword } from "@/lib/crypto";

// Helper to check admin authentication
async function verifyAdminAuth() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_session")?.value;

  if (!adminCookie) return null;
  return await verifyAdminToken(adminCookie);
}

// GET: Fetch all B2B Clients
export async function GET(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { data: clients, error } = await supabaseAdmin
      .from("clients")
      .select("id, org_name, username, status, notification_emails, created_at, updated_at")
      .order("org_name", { ascending: true });

    if (error) {
      console.error("Error fetching B2B clients:", error);
      return NextResponse.json({ error: "Failed to retrieve client list." }, { status: 500 });
    }

    return NextResponse.json({ success: true, clients });
  } catch (err: any) {
    console.error("Admin B2B clients GET error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// POST: Create a new B2B Client
export async function POST(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { org_name, username, password } = await req.json();

    if (!org_name?.trim()) {
      return NextResponse.json({ error: "Organization Name is required." }, { status: 400 });
    }
    if (!username?.trim()) {
      return NextResponse.json({ error: "Username / Login email is required." }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const envUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();

    // 1. Restrict username from being "admin"
    if (cleanUsername === "admin" || cleanUsername === envUsername) {
      return NextResponse.json({ error: "Username 'admin' is reserved and cannot be used for B2B client accounts." }, { status: 400 });
    }

    // 2. Enforce email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanUsername)) {
      return NextResponse.json({ error: "Client username must be a valid email address (e.g. partner@corp.com)." }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Hash the password with a secure salt
    const { hash, salt } = hashPassword(password);

    const { data: newClient, error } = await supabaseAdmin
      .from("clients")
      .insert([
        {
          org_name: org_name.trim(),
          username: username.trim().toLowerCase(),
          password: hash,
          salt,
          status: "active",
          notification_emails: [],
        },
      ])
      .select("id, org_name, username, status, notification_emails, created_at")
      .single();

    if (error) {
      console.error("Error creating B2B client:", error);
      if (error.code === "23505") { // Unique violation
        return NextResponse.json({ error: "Organization Name or Username already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create client account." }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: newClient });
  } catch (err: any) {
    console.error("Admin B2B clients POST error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// PUT: Update Client Status, Reset Password, or Edit Workspace Details
export async function PUT(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { id, status, password, org_name, username } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    // Handle status update
    if (status) {
      if (!["active", "suspended", "restricted"].includes(status)) {
        return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
      }
      updatePayload.status = status;
    }

    // Handle organization name edit
    if (org_name?.trim()) {
      updatePayload.org_name = org_name.trim();
    }

    // Handle username / login email edit
    if (username?.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      const envUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();

      if (cleanUsername === "admin" || cleanUsername === envUsername) {
        return NextResponse.json({ error: "Username 'admin' is reserved and cannot be used." }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanUsername)) {
        return NextResponse.json({ error: "Client username must be a valid email address." }, { status: 400 });
      }

      updatePayload.username = cleanUsername;
    }

    // Handle password reset
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }
      const { hash, salt } = hashPassword(password);
      updatePayload.password = hash;
      updatePayload.salt = salt;
    }

    const { data: updatedClient, error } = await supabaseAdmin
      .from("clients")
      .update(updatePayload)
      .eq("id", id)
      .select("id, org_name, username, status, notification_emails, updated_at")
      .single();

    if (error) {
      console.error("Error updating B2B client:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Organization Name or Username already exists." }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to update client account." }, { status: 500 });
    }

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (err: any) {
    console.error("Admin B2B clients PUT error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// DELETE: Delete a B2B Client (Cascade deletes requests due to database foreign key)
export async function DELETE(req: NextRequest) {
  try {
    const adminSession = await verifyAdminAuth();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized. Admin session required." }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Client ID is required for deletion." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting B2B client:", error);
      return NextResponse.json({ error: "Failed to delete client account." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin B2B clients DELETE error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
