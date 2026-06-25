import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Helper to verify admin session
async function isAdminAuthorized() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_session")?.value;
  if (!adminCookie) return false;
  const session = await verifyAdminToken(adminCookie);
  return !!session;
}

// GET all guards
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  
  const { data, error } = await supabaseAdmin
    .from("security_guards")
    .select("*")
    .order("name", { ascending: true });
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ guards: data });
}

// POST create guard
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  
  try {
    const { name, phone, code } = await req.json();
    if (!name?.trim() || !phone?.trim() || !code?.trim()) {
      return NextResponse.json({ error: "Name, phone, and code are required." }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from("security_guards")
      .insert([
        {
          name: name.trim(),
          phone: phone.trim(),
          code: code.trim(),
          status: "active",
        },
      ])
      .select()
      .single();
      
    if (error) {
      if (error.code === "23505") { // Unique constraint violation on code
        return NextResponse.json({ error: "This guard authorization code is already assigned to another officer." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, guard: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request body." }, { status: 400 });
  }
}

// PUT update guard
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  
  try {
    const { id, name, phone, code, status } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Guard ID is required." }, { status: 400 });
    }
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (code !== undefined) updateData.code = code.trim();
    if (status !== undefined) updateData.status = status;
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabaseAdmin
      .from("security_guards")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
      
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This guard authorization code is already assigned to another officer." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, guard: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request body." }, { status: 400 });
  }
}

// DELETE guard
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthorized())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Guard ID is required." }, { status: 400 });
    }
    
    const { error } = await supabaseAdmin
      .from("security_guards")
      .delete()
      .eq("id", id);
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request body." }, { status: 400 });
  }
}
