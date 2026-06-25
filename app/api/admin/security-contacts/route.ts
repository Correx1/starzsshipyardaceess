import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST: Add a new security contact
export async function POST(req: NextRequest) {
  try {
    const { name, phone_number } = await req.json();

    if (!name?.trim() || !phone_number?.trim()) {
      return NextResponse.json({ error: "Name and phone number are required." }, { status: 400 });
    }

    // Insert new contact into security_contacts table
    const { data: newContact, error } = await supabaseAdmin
      .from("security_contacts")
      .insert([
        {
          name: name.trim(),
          phone_number: phone_number.trim(),
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error || !newContact) {
      console.error("Error adding security contact:", error);
      return NextResponse.json({ error: "Failed to save security contact." }, { status: 500 });
    }

    return NextResponse.json({ success: true, contact: newContact });
  } catch (err: any) {
    console.error("Security contacts POST API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// DELETE: Remove a security contact
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required." }, { status: 400 });
    }

    // Delete contact from table
    const { error } = await supabaseAdmin
      .from("security_contacts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting security contact:", error);
      return NextResponse.json({ error: "Failed to remove security contact." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Security contacts DELETE API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
