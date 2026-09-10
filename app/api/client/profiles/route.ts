import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET saved drivers and staff for the authenticated sister company client
export async function GET() {
  try {
    const cookieStore = await cookies();
    const clientCookie = cookieStore.get("client_session")?.value;

    if (!clientCookie) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const clientSession = await verifyClientToken(clientCookie);
    if (!clientSession || !clientSession.id) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const clientId = clientSession.id;

    // Fetch from client_drivers
    const { data: driversDb, error: driverErr } = await supabaseAdmin
      .from("client_drivers")
      .select("id, name, phone")
      .eq("client_id", clientId)
      .order("name", { ascending: true });

    // Fetch from client_staff
    const { data: staffDb, error: staffErr } = await supabaseAdmin
      .from("client_staff")
      .select("id, name, email")
      .eq("client_id", clientId)
      .order("name", { ascending: true });

    let drivers = driversDb || [];
    let staff = staffDb || [];

    // Self-healing fallback to access_requests history if tables are empty or not yet seeded
    if (drivers.length === 0 || staff.length === 0) {
      const { data: history } = await supabaseAdmin
        .from("access_requests")
        .select("visitor_name, visitor_phone, requesting_staff_name, requesting_staff_email")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (history && history.length > 0) {
        if (drivers.length === 0) {
          const dMap = new Map<string, string>();
          history.forEach((h) => {
            if (h.visitor_name && !dMap.has(h.visitor_name.trim().toLowerCase())) {
              dMap.set(h.visitor_name.trim().toLowerCase(), (h.visitor_phone || "").trim());
            }
          });
          drivers = Array.from(dMap.entries()).map(([k, phone]) => {
            const orig = history.find((h) => h.visitor_name?.trim().toLowerCase() === k);
            return { name: orig?.visitor_name || k, phone };
          });
        }

        if (staff.length === 0) {
          const sMap = new Map<string, string>();
          history.forEach((h) => {
            if (h.requesting_staff_name && !sMap.has(h.requesting_staff_name.trim().toLowerCase())) {
              sMap.set(h.requesting_staff_name.trim().toLowerCase(), (h.requesting_staff_email || "").trim());
            }
          });
          staff = Array.from(sMap.entries()).map(([k, email]) => {
            const orig = history.find((h) => h.requesting_staff_name?.trim().toLowerCase() === k);
            return { name: orig?.requesting_staff_name || k, email };
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      drivers,
      staff,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load profiles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Save or update driver and staff profile
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const clientCookie = cookieStore.get("client_session")?.value;

    if (!clientCookie) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const clientSession = await verifyClientToken(clientCookie);
    if (!clientSession || !clientSession.id) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const clientId = clientSession.id;
    const body = await req.json();
    const { driver, staff } = body;

    if (driver && driver.name && driver.name.trim()) {
      await supabaseAdmin.from("client_drivers").upsert(
        {
          client_id: clientId,
          name: driver.name.trim(),
          phone: (driver.phone || "").trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,name" }
      );
    }

    if (staff && staff.name && staff.name.trim()) {
      await supabaseAdmin.from("client_staff").upsert(
        {
          client_id: clientId,
          name: staff.name.trim(),
          email: (staff.email || "").trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,name" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
