import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyPassword } from "@/lib/crypto";
import { signClientToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    // 1. Fetch  client by username from Supabase
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("username", username.trim().toLowerCase())
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // 2. Check account status
    if (client.status === "suspended") {
      return NextResponse.json(
        { error: "Your account has been suspended by the administrator." },
        { status: 403 }
      );
    }

    // 3. Verify salted hashed password
    const isPasswordValid = verifyPassword(password, client.password, client.salt);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // 4. Sign the  Client JWT token
    const token = await signClientToken({
      id: client.id,
      username: client.username,
      org_name: client.org_name,
    });

    // 5. Create response and set cookie
    const response = NextResponse.json({
      success: true,
      org_name: client.org_name,
      status: client.status,
    });

    response.cookies.set({
      name: "client_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Client login API Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
