import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, verifyClientToken } from "./lib/auth";
import { createClient } from "@supabase/supabase-js";

// Initialize lightweight Supabase client using service role key to bypass RLS for status checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. ADMIN ROUTE PROTECTION (/dashboard/* and /api/admin/*)
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/admin")) {
    const adminCookie = req.cookies.get("admin_session")?.value;
    let isAdminAuthenticated = false;

    if (adminCookie) {
      const session = await verifyAdminToken(adminCookie);
      if (session) {
        isAdminAuthenticated = true;
      }
    }

    if (!isAdminAuthenticated) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { error: "Unauthorized. Admin session expired or invalid." },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // 2. B2B CLIENT ROUTE PROTECTION (/client/dashboard/* and /api/client/*)
  if (pathname.startsWith("/client/dashboard") || pathname.startsWith("/api/client")) {
    // Exclude the login page and login API from protection to prevent infinite loops!
    if (pathname === "/" || pathname === "/api/auth/login") {
      return NextResponse.next();
    }

    const clientCookie = req.cookies.get("client_session")?.value;
    let isClientAuthenticated = false;
    let clientSessionPayload = null;

    if (clientCookie) {
      clientSessionPayload = await verifyClientToken(clientCookie);
      if (clientSessionPayload) {
        isClientAuthenticated = true;
      }
    }

    // Redirect if session is missing or invalid
    if (!isClientAuthenticated || !clientSessionPayload) {
      if (pathname.startsWith("/api/client")) {
        return NextResponse.json(
          { error: "Unauthorized. Client session expired or invalid." },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Real-time Account Status check: Ensure client is not suspended
    try {
      const { data: clientDb, error } = await supabase
        .from("clients")
        .select("status")
        .eq("id", clientSessionPayload.id)
        .single();

      if (error || !clientDb) {
        throw new Error("Client not found in database.");
      }

      // If suspended, clear the session cookie instantly and redirect to login
      if (clientDb.status === "suspended") {
        const response = pathname.startsWith("/api/client")
          ? NextResponse.json({ error: "Your account has been suspended by the administrator." }, { status: 403 })
          : NextResponse.redirect(new URL("/?error=suspended", req.url));
          
        response.cookies.set({
          name: "client_session",
          value: "",
          maxAge: 0,
          path: "/",
        });
        return response;
      }
    } catch (err) {
      // If database is unreachable or client is missing, treat as unauthenticated
      const response = pathname.startsWith("/api/client")
        ? NextResponse.json({ error: "Session validation failed." }, { status: 401 })
        : NextResponse.redirect(new URL("/", req.url));
        
      response.cookies.set({
        name: "client_session",
        value: "",
        maxAge: 0,
        path: "/",
      });
      return response;
    }
  }

  return NextResponse.next();
}

// Intercept all admin and B2B client routes
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/admin/:path*",
    "/client/dashboard/:path*",
    "/api/client/:path*",
  ],
};
