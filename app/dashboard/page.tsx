/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_session")?.value;

  if (!adminCookie) {
    redirect("/");
  }

  // 1. Verify Admin Token
  const adminSession = await verifyAdminToken(adminCookie);
  if (!adminSession) {
    redirect("/");
  }

  // 2. Fetch all B2B Client Accounts
  const { data: clientsData, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, org_name, username, status, notification_emails, created_at, updated_at")
    .order("org_name", { ascending: true });

  if (clientsError) {
    console.error("Error fetching B2B clients for admin:", clientsError);
  }

  // 3. Fetch all B2B Access Requests joined with Client details
  const { data: requestsData, error: requestsError } = await supabaseAdmin
    .from("access_requests")
    .select(`
      *,
      clients (
        org_name
      )
    `)
    .order("created_at", { ascending: false });

  if (requestsError) {
    console.error("Error fetching access requests for admin:", requestsError);
  }

  // 4. Fetch/Seed Admin Notification Emails (Self-Healing Check)
  let adminEmails = "";
  const { data: emailsSettingRaw, error: emailsError } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", "admin_notification_emails")
    .single();

  const emailsSetting = emailsSettingRaw as any;

  if (emailsSetting && !emailsError) {
    adminEmails = emailsSetting.value;
  } else {
    // Self-healing: if the key doesn't exist, create it!
    try {
      await supabaseAdmin
        .from("admin_settings")
        .insert([{ key: "admin_notification_emails", value: "" }] as any)
        .select()
        .single();
    } catch (err) {
      console.error("Error self-healing admin_notification_emails setting:", err);
    }
  }

  // 5. Fetch/Seed Allowed Resource Categories (Self-Healing Check)
  let allowedCategories = ["machinery", "staff", "materials", "other"];
  const { data: categoriesSettingRaw, error: categoriesError } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", "allowed_resource_categories")
    .single();

  const categoriesSetting = categoriesSettingRaw as any;

  if (categoriesSetting && !categoriesError) {
    try {
      allowedCategories = JSON.parse(categoriesSetting.value);
    } catch (e) {
      console.error("Error parsing allowed categories setting:", e);
    }
  } else {
    // Self-healing: if the key doesn't exist, write defaults!
    try {
      await supabaseAdmin
        .from("admin_settings")
        .insert([{ key: "allowed_resource_categories", value: JSON.stringify(allowedCategories) }] as any)
        .select()
        .single();
    } catch (err) {
      console.error("Error self-healing allowed_resource_categories setting:", err);
    }
  }

  // 6. Fetch all Security Guards
  const { data: guardsData, error: guardsError } = await supabaseAdmin
    .from("security_guards")
    .select("*")
    .order("name", { ascending: true });

  if (guardsError) {
    console.error("Error fetching security guards for admin:", guardsError);
  }

  // 7. Fetch Admin Signatures
  let sigName = "";
  let sigPhone = "";
  let sigCompany = "";
  try {
    const { data: sigSettings } = await supabaseAdmin
      .from("admin_settings")
      .select("key, value")
      .in("key", ["admin_signature_name", "admin_signature_phone", "admin_signature_company"]);

    if (sigSettings) {
      sigSettings.forEach((s: any) => {
        if (s.key === "admin_signature_name") sigName = s.value;
        if (s.key === "admin_signature_phone") sigPhone = s.value;
        if (s.key === "admin_signature_company") sigCompany = s.value;
      });
    }
  } catch (sigErr) {
    console.error("Error loading admin signature settings in page:", sigErr);
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
    clientOrgName: req.clients?.org_name || "B2B Partner",
    client_id: req.client_id,
    entered_by: req.entered_by,
    exited_by: req.exited_by,
    requesting_staff_name: req.requesting_staff_name,
    requesting_staff_email: req.requesting_staff_email,
  }));

  const mappedClients = (clientsData || []).map((c: any) => ({
    id: c.id,
    org_name: c.org_name,
    username: c.username,
    status: c.status as "active" | "suspended" | "restricted",
    notification_emails: Array.isArray(c.notification_emails) ? c.notification_emails : [],
    created_at: c.created_at,
  }));

  const mappedGuards = (guardsData || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    phone: g.phone,
    code: g.code,
    status: g.status as "active" | "inactive",
    created_at: g.created_at,
  }));

  return (
    <AdminDashboard
      initialClients={mappedClients}
      initialRequests={mappedRequests}
      initialAdminEmails={adminEmails}
      initialAllowedCategories={allowedCategories}
      initialGuards={mappedGuards}
      initialSignatureName={sigName}
      initialSignaturePhone={sigPhone}
      initialSignatureCompany={sigCompany}
    />
  );
}
