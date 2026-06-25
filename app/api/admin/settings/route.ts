import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();

    if (!key?.trim()) {
      return NextResponse.json({ error: "Setting key is required." }, { status: 400 });
    }

    // Upsert key-value pair in admin_settings table
    const { data, error } = await supabaseAdmin
      .from("admin_settings")
      .upsert(
        {
          key: key.trim(),
          value: value?.trim() || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating admin settings:", error);
      return NextResponse.json({ error: "Failed to save configuration settings." }, { status: 500 });
    }

    return NextResponse.json({ success: true, setting: data });
  } catch (err: any) {
    console.error("Admin settings POST API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
