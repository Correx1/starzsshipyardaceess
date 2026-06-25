import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    // 1. Terminate all currently active form tokens
    const { error: terminateError } = await supabaseAdmin
      .from("form_tokens")
      .update({ is_active: false, terminated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("is_active", true);

    if (terminateError) {
      console.error("Error terminating tokens:", terminateError);
      return NextResponse.json({ error: "Failed to deactivate previous links." }, { status: 500 });
    }

    // 2. Generate a new cryptographically secure token
    const newToken = nanoid(24);

    // 3. Insert the new token into the database
    const { data: insertedToken, error: insertError } = await supabaseAdmin
      .from("form_tokens")
      .insert([
        {
          token: newToken,
          label: `Rotated Link - ${new Date().toLocaleDateString()}`,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError || !insertedToken) {
      console.error("Error inserting new token:", insertError);
      return NextResponse.json({ error: "Failed to generate new access link." }, { status: 500 });
    }

    return NextResponse.json({ success: true, token: insertedToken.token });
  } catch (err: any) {
    console.error("Regenerate token API error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
