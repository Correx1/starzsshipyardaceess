/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyClientToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import ClientDashboard from "@/components/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const cookieStore = await cookies();
  const clientCookie = cookieStore.get("client_session")?.value;

  if (!clientCookie) {
    redirect("/");
  }

  // 1. Verify  Client Token
  const clientSession = await verifyClientToken(clientCookie);
  if (!clientSession) {
    redirect("/");
  }

  // 2. Fetch Client's latest details from database (for real-time status and emails checking)
  const { data: clientDbRaw, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, org_name, username, status, notification_emails")
    .eq("id", clientSession.id)
    .single();

  const clientDb = clientDbRaw as any;

  if (clientError || !clientDb) {
    console.error("Error fetching client details:", clientError);
    redirect("/?error=invalid_session");
  }

  // Double check if account was suspended
  if (clientDb.status === "suspended") {
    redirect("/?error=suspended");
  }

  // 3. Fetch Client's submitted access requests
  const { data: requestsData, error: requestsError } = await supabaseAdmin
    .from("access_requests")
    .select("*")
    .eq("client_id", clientSession.id)
    .order("created_at", { ascending: false });

  if (requestsError) {
    console.error("Error fetching client requests:", requestsError);
  }

  // 4. Fetch allowed resource categories configured by the Admin
  let allowedCategories = ["machinery", "staff", "materials", "other"];
  const { data: settingsDataRaw, error: settingsError } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", "allowed_resource_categories")
    .single();

  const settingsData = settingsDataRaw as any;

  if (settingsData && !settingsError) {
    try {
      allowedCategories = JSON.parse(settingsData.value);
    } catch (e) {
      console.error("Error parsing allowed resource categories:", e);
    }
  }

  // Map database requests to component types
  const mappedRequests = (requestsData || []).map((req: any) => ({
    id: req.id,
    ticket_number: req.ticket_number,
    pin_code: req.pin_code,
    visitor_name: req.visitor_name,
    visitor_email: req.visitor_email,
    visitor_phone: req.visitor_phone,
    resources: Array.isArray(req.resources) ? req.resources : [],
    expected_date: req.expected_date,
    status: req.status,
    denial_reason: req.denial_reason,
    entered_at: req.entered_at,
    exited_at: req.exited_at,
    created_at: req.created_at,
  }));

  const notificationEmails = Array.isArray(clientDb.notification_emails)
    ? clientDb.notification_emails
    : [];

  return (
    <ClientDashboard
      clientId={clientDb.id}
      clientOrgName={clientDb.org_name}
      clientUsername={clientDb.username}
      clientStatus={clientDb.status as "active" | "restricted"}
      initialRequests={mappedRequests}
      initialNotificationEmails={notificationEmails}
      allowedCategories={allowedCategories}
    />
  );
}
