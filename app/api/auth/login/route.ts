import { NextRequest, NextResponse } from "next/server";
import { signAdminToken, signClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyPassword } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const envUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
    const envPassword = process.env.ADMIN_PASSWORD;

    // 1. Check if it matches Admin credentials
    if (cleanUsername === envUsername) {
      if (!envPassword) {
        return NextResponse.json(
          { error: "Admin credentials are not configured in environment variables." },
          { status: 500 }
        );
      }

      if (password !== envPassword) {
        return NextResponse.json(
          { error: "Invalid username or password." },
          { status: 401 }
        );
      }

      // Sign the admin token
      const token = await signAdminToken(username.trim());
      const response = NextResponse.json({ role: "admin", success: true });

      // Set admin cookie, clear client cookie
      response.cookies.set({
        name: "admin_session",
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      response.cookies.set({
        name: "client_session",
        value: "",
        maxAge: 0,
        path: "/",
      });

      return response;
    }

    // 2. Otherwise, check B2B client registry
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("username", cleanUsername)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Check account suspension
    if (client.status === "suspended") {
      return NextResponse.json(
        { error: "Your B2B account has been suspended. Please contact administration." },
        { status: 403 }
      );
    }

    // Verify salted password
    const isPasswordValid = verifyPassword(password, client.password, client.salt);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Sign the Client token
    const token = await signClientToken({
      id: client.id,
      username: client.username,
      org_name: client.org_name,
    });

    const response = NextResponse.json({
      role: "client",
      success: true,
      org_name: client.org_name,
    });

    // Set client cookie, clear admin cookie
    response.cookies.set({
      name: "client_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.cookies.set({
      name: "admin_session",
      value: "",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Unified Login API Error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
