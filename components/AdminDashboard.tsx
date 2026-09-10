/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  LogOut, X, AlertTriangle, Plus,
  User, Phone, Calendar, Loader2, CheckCircle2, XCircle, 
  Search, Filter, Eye, Settings, 
  Users, Briefcase, Printer, Shield, Activity, Trash2, RotateCw, Edit, Mail,
  Download, FileSpreadsheet, CreditCard, EyeOff, Copy, Check, Key
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportToExcel, exportToCSV, ExportableRequest } from "@/lib/exportUtils";
import DashboardHeader from "./DashboardHeader";
import FleetGateCard from "./FleetGateCard";


interface ResourceItem {
  category: string;
  quantity: number;
  type: string;
  details: string;
}

export interface CompanyCard {
  id: string;
  card_number: string;
  client_id: string;
  label: string;
  pin: string;
  status: "active" | "frozen" | "revoked";
  created_at: string;
  updated_at?: string;
  clientOrgName?: string;
  clients?: {
    id: string;
    org_name: string;
    username: string;
  };
}

interface AccessRequest {
  id: string;
  ticket_number: string;
  pin_code: string;
  visitor_name: string;
  visitor_phone: string;
  resources: ResourceItem[];
  expected_date: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  denial_reason: string | null;
  entered_at: string | null;
  exited_at: string | null;
  created_at: string;
  clientOrgName: string;
  client_id?: string;
  gate_notes?: string | null;
  last_rescheduled_at?: string | null;
  entered_by?: string | null;
  exited_by?: string | null;
  requesting_staff_name?: string;
  requesting_staff_email?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

interface Client {
  id: string;
  org_name: string;
  username: string;
  status: "active" | "suspended" | "restricted";
  notification_emails: string[];
  created_at: string;
}

interface DbAccessRequest {
  id: string;
  ticket_number: string;
  pin_code: string;
  visitor_name: string;
  visitor_phone: string;
  resources: ResourceItem[];
  expected_date: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  denial_reason: string | null;
  entered_at: string | null;
  exited_at: string | null;
  created_at: string;
  client_id: string;
  gate_notes?: string | null;
  last_rescheduled_at?: string | null;
  entered_by?: string | null;
  exited_by?: string | null;
  requesting_staff_name?: string;
  requesting_staff_email?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

interface SecurityGuard {
  id: string;
  name: string;
  phone: string;
  code: string;
  status: "active" | "inactive";
  created_at: string;
}

interface AdminDashboardProps {
  initialClients: Client[];
  initialRequests: AccessRequest[];
  initialAdminEmails: string;
  initialAllowedCategories: string[];
  initialGuards: SecurityGuard[];
  initialSignatureName: string;
  initialSignaturePhone: string;
  initialSignatureCompany: string;
  initialCards?: CompanyCard[];
}

export default function AdminDashboard({
  initialClients,
  initialRequests,
  initialAdminEmails,
  initialAllowedCategories,
  initialGuards = [],
  initialSignatureName = "",
  initialSignaturePhone = "",
  initialSignatureCompany = "",
  initialCards = [],
}: AdminDashboardProps) {
  const router = useRouter();


  // Helper to generate a unique guard PIN code: 4 numbers and 2 letters at the ending (e.g. 5829TY)
  const generateGuardCode = (existingGuards: SecurityGuard[]) => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let code = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 1000) {
      let numPart = "";
      for (let i = 0; i < 4; i++) {
        numPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
      }
      let letPart = "";
      for (let i = 0; i < 2; i++) {
        letPart += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      code = numPart + letPart;
      isUnique = !existingGuards.some((g) => g.code.toUpperCase() === code.toUpperCase());
      attempts++;
    }
    return code;
  };

  // State Management
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);
  const [clients, setClients] = useState<Client[]>(initialClients);

  // Sidebar Collapsible State (for PC & Mobile Drawer Overlay)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  //  Client Editing States
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // Focus Request Logs Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "denied" | "inside" | "expired">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<"all" | string>("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Outgoing Email Signature Editing State
  const [isEditingSignature, setIsEditingSignature] = useState(false);

  // Selection states
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);

  // Client creation form state
  const [newClientOrg, setNewClientOrg] = useState("");
  const [newClientUser, setNewClientUser] = useState("");
  const [newClientPass, setNewClientPass] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(null);
  const [createClientSuccess, setCreateClientSuccess] = useState<string | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);

  // Security Guards CRUD States
  const [guards, setGuards] = useState<SecurityGuard[]>(initialGuards);
  const [guardName, setGuardName] = useState("");
  const [guardPhone, setGuardPhone] = useState("");
  const [guardCode, setGuardCode] = useState(() => generateGuardCode(initialGuards));
  const [editingGuardId, setEditingGuardId] = useState<string | null>(null);
  const [isSavingGuard, setIsSavingGuard] = useState(false);
  const [guardError, setGuardError] = useState<string | null>(null);
  const [showGuardForm, setShowGuardForm] = useState(false);

  // Admin Signature States
  const [sigName, setSigName] = useState(initialSignatureName);
  const [sigPhone, setSigPhone] = useState(initialSignaturePhone);
  const [sigCompany, setSigCompany] = useState(initialSignatureCompany);

  // Settings form state
  const [settingsCategories, setSettingsCategories] = useState<string[]>(initialAllowedCategories);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Pill-based Email Builder States
  const [emailPills, setEmailPills] = useState<string[]>(
    initialAdminEmails
      ? initialAdminEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : []
  );
  const [emailInput, setEmailInput] = useState("");

  // Decision States (Drawer)
  const [denialReasonInput, setDenialReasonInput] = useState("");
  const [showDenyReasonForm, setShowDenyReasonForm] = useState(false);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Copy helpers
  const [isCopied, setIsCopied] = useState(false);
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Audit Export Modal States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [exportCustomStart, setExportCustomStart] = useState("");
  const [exportCustomEnd, setExportCustomEnd] = useState("");
  const [exportPartnerId, setExportPartnerId] = useState<"all" | string>("all");
  const [exportStatus, setExportStatus] = useState<"all" | "pending" | "approved" | "inside" | "expired" | "denied">("all");

  // Company Cards States
  const [cards, setCards] = useState<CompanyCard[]>(initialCards || []);
  const [cardSearch, setCardSearch] = useState("");
  const [cardFilterClient, setCardFilterClient] = useState<"all" | string>("all");
  const [isIssuingCard, setIsIssuingCard] = useState(false);
  const [issueClientId, setIssueClientId] = useState("");
  const [issueCardPin, setIssueCardPin] = useState("");
  const [issueCardError, setIssueCardError] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [previewCard, setPreviewCard] = useState<CompanyCard | null>(null);
  const [revealedCardPins, setRevealedCardPins] = useState<Record<string, boolean>>({});
  const [copiedCardNum, setCopiedCardNum] = useState<string | null>(null);

  // Reload cards
  const reloadCards = async () => {
    try {
      const res = await fetch("/api/admin/cards");
      const data = await res.json();
      if (data.success && data.cards) {
        const mapped = data.cards.map((c: CompanyCard & { clients?: { org_name: string } }) => ({
          ...c,
          clientOrgName: c.clients?.org_name || "Sister Company",
        }));
        setCards(mapped);
      }
    } catch (e) {
      console.error("Error reloading cards:", e);
    }
  };

  const handleIssueCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueCardError(null);
    if (!issueClientId) {
      setIssueCardError("Please select a Sister Company.");
      return;
    }
    setIsIssuingCard(true);

    try {
      const matchingClient = clients.find((c) => c.id === issueClientId);
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: issueClientId,
          label: matchingClient?.org_name || "Fleet Vehicle Card",
          pin: issueCardPin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to issue fleet badge");

      if (data.card) {
        const mappedCard = {
          ...data.card,
          clientOrgName: matchingClient ? matchingClient.org_name : "Sister Company",
        };
        setCards((prev) => [mappedCard, ...prev]);
      }
      setShowCardForm(false);
      setIssueClientId("");
      setIssueCardPin("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to issue card.";
      setIssueCardError(errorMsg);
    } finally {
      setIsIssuingCard(false);
    }
  };

  const handleUpdateCardStatus = async (cardId: string, nextStatus: "active" | "frozen" | "revoked") => {
    try {
      const res = await fetch("/api/admin/cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, status: nextStatus } : c))
        );
      }
    } catch (e) {
      console.error("Failed to update card status:", e);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("Are you sure you want to permanently delete this company card?")) return;
    try {
      const res = await fetch("/api/admin/cards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId }),
      });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== cardId));
      }
    } catch (e) {
      console.error("Failed to delete card:", e);
    }
  };

  const handleCopyCardNum = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedCardNum(num);
    setTimeout(() => setCopiedCardNum(null), 2000);
  };




  // Pill email builder helper methods with immediate persistence
  const handleAddEmailPill = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (emailPills.includes(cleanEmail)) {
      alert("This email address is already added.");
      return;
    }

    const updatedPills = [...emailPills, cleanEmail];
    setEmailPills(updatedPills);
    setEmailInput("");

    // Persist immediately to database
    const joinedEmails = updatedPills.join(", ");
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "admin_notification_emails",
          value: joinedEmails,
        }),
      });
    } catch (err) {
      console.error("Failed to persist email addition:", err);
    }
  };

  const handleRemoveEmailPill = async (emailToRemove: string) => {
    const updatedPills = emailPills.filter((e) => e !== emailToRemove);
    setEmailPills(updatedPills);

    // Persist immediately to database
    const joinedEmails = updatedPills.join(", ");
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "admin_notification_emails",
          value: joinedEmails,
        }),
      });
    } catch (err) {
      console.error("Failed to persist email deletion:", err);
    }
  };

  // Add Dynamic Category with immediate persistence
  const handleAddCategory = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const cat = newCategoryInput.trim().toLowerCase();
    if (!cat) return;

    if (settingsCategories.includes(cat)) {
      alert("This category already exists.");
      return;
    }

    const updatedCats = [...settingsCategories, cat];
    setSettingsCategories(updatedCats);
    setNewCategoryInput("");

    // Persist immediately to database
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "allowed_resource_categories",
          value: JSON.stringify(updatedCats),
        }),
      });
    } catch (err) {
      console.error("Failed to persist category addition:", err);
    }
  };

  // Remove Dynamic Category with immediate persistence
  const handleRemoveCategory = async (catToRemove: string) => {
    if (settingsCategories.length === 1) {
      alert("At least one request category must be enabled in the system.");
      return;
    }
    
    const updatedCats = settingsCategories.filter((c) => c !== catToRemove);
    setSettingsCategories(updatedCats);

    // Persist immediately to database
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "allowed_resource_categories",
          value: JSON.stringify(updatedCats),
        }),
      });
    } catch (err) {
      console.error("Failed to persist category deletion:", err);
    }
  };

  // Create or Update Security Guard
  const handleSaveGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardError(null);

    if (!guardName.trim() || !guardPhone.trim() || !guardCode.trim()) {
      setGuardError("Please fill in all guard details.");
      return;
    }

    setIsSavingGuard(true);

    try {
      const isEditing = !!editingGuardId;
      const url = "/api/admin/guards";
      const method = isEditing ? "PUT" : "POST";
      const bodyData = isEditing 
        ? { id: editingGuardId, name: guardName, phone: guardPhone, code: guardCode }
        : { name: guardName, phone: guardPhone, code: guardCode };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save guard.");

      if (isEditing) {
        setGuards((prev) => prev.map((g) => (g.id === editingGuardId ? data.guard : g)));
        alert("Security guard details updated successfully.");
      } else {
        setGuards((prev) => [...prev, data.guard]);
        alert("New security guard added successfully.");
      }

      // Reset form
      setGuardName("");
      setGuardPhone("");
      setGuardCode("");
      setEditingGuardId(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to save security guard.";
      setGuardError(errMsg);
    } finally {
      setIsSavingGuard(false);
    }
  };

  // Toggle Guard Status
  const handleToggleGuardStatus = async (guardId: string, currentStatus: "active" | "inactive") => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const response = await fetch("/api/admin/guards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: guardId,
          status: newStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setGuards((prev) => prev.map((g) => (g.id === guardId ? { ...g, status: newStatus } : g)));
      alert(`Guard status updated to: ${newStatus.toUpperCase()}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert("Failed to update guard status: " + errMsg);
    }
  };

  // Delete Security Guard
  const handleDeleteGuard = async (guardId: string, guardName: string) => {
    const confirmed = confirm(`Are you sure you want to permanently remove security guard officer "${guardName}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch("/api/admin/guards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: guardId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setGuards((prev) => prev.filter((g) => g.id !== guardId));
      alert(`Officer "${guardName}" has been removed from registry.`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert("Failed to remove guard: " + errMsg);
    }
  };

  // Reloads requests table client-side for Admin
  const reloadRequests = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        // Map clients to get their org names
        const mappedData = data.map((req) => {
          const matchingClient = clients.find((c) => c.id === req.client_id);
          return {
            ...req,
            clientOrgName: matchingClient ? matchingClient.org_name : " Partner",
          };
        });
        setRequests(mappedData as AccessRequest[]);
      }
    } catch (err) {
      console.error("Failed to refresh admin table:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real-time Supabase Subscription for Access Requests
  useEffect(() => {
    const subscription = supabase
      .channel("admin_access_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_requests" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newReq = payload.new as DbAccessRequest;
            // Map client organization label locally from existing clients state
            const matchingClient = clients.find((c) => c.id === newReq.client_id);
            const mappedReq: AccessRequest = {
              id: newReq.id,
              ticket_number: newReq.ticket_number,
              pin_code: newReq.pin_code,
              visitor_name: newReq.visitor_name,
              visitor_phone: newReq.visitor_phone,
              resources: Array.isArray(newReq.resources) ? newReq.resources : [],
              expected_date: newReq.expected_date,
              status: newReq.status,
              denial_reason: newReq.denial_reason,
              entered_at: newReq.entered_at,
              exited_at: newReq.exited_at,
              created_at: newReq.created_at,
              clientOrgName: matchingClient ? matchingClient.org_name : " Partner",
              client_id: newReq.client_id,
              gate_notes: newReq.gate_notes,
              last_rescheduled_at: newReq.last_rescheduled_at,
              entered_by: newReq.entered_by,
              exited_by: newReq.exited_by,
              requesting_staff_name: newReq.requesting_staff_name,
              requesting_staff_email: newReq.requesting_staff_email,
              is_deleted: newReq.is_deleted,
              deleted_at: newReq.deleted_at,
            };
            setRequests((prev) => [mappedReq, ...prev.filter((r) => r.id !== mappedReq.id)]);
          } else if (payload.eventType === "UPDATE") {
            const updatedReq = payload.new as DbAccessRequest;
            const matchingClient = clients.find((c) => c.id === updatedReq.client_id);
            const mappedReq: AccessRequest = {
              id: updatedReq.id,
              ticket_number: updatedReq.ticket_number,
              pin_code: updatedReq.pin_code,
              visitor_name: updatedReq.visitor_name,
              visitor_phone: updatedReq.visitor_phone,
              resources: Array.isArray(updatedReq.resources) ? updatedReq.resources : [],
              expected_date: updatedReq.expected_date,
              status: updatedReq.status,
              denial_reason: updatedReq.denial_reason,
              entered_at: updatedReq.entered_at,
              exited_at: updatedReq.exited_at,
              created_at: updatedReq.created_at,
              clientOrgName: matchingClient ? matchingClient.org_name : " Partner",
              client_id: updatedReq.client_id,
              gate_notes: updatedReq.gate_notes,
              last_rescheduled_at: updatedReq.last_rescheduled_at,
              entered_by: updatedReq.entered_by,
              exited_by: updatedReq.exited_by,
              requesting_staff_name: updatedReq.requesting_staff_name,
              requesting_staff_email: updatedReq.requesting_staff_email,
              is_deleted: updatedReq.is_deleted,
              deleted_at: updatedReq.deleted_at,
            };

            setRequests((prev) =>
              prev.map((req) => (req.id === mappedReq.id ? mappedReq : req))
            );

            // Update drawer if selected
            setSelectedRequest((prev) =>
              prev && prev.id === mappedReq.id ? mappedReq : prev
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setRequests((prev) => prev.filter((req) => req.id !== deletedId));
          }
        }
      )
      .subscribe();

    const cardsSub = supabase
      .channel("admin_company_cards")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_cards" },
        () => {
          reloadCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(cardsSub);
    };
  }, [clients]);

  // Sign out Admin
  const handleSignOut = async () => {
    setIsSignOutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
      setIsSignOutLoading(false);
    }
  };

  // Create or Edit  Client Workspace
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateClientError(null);
    setCreateClientSuccess(null);

    const isEditing = !!editingClientId;
    if (!newClientOrg.trim() || !newClientUser.trim() || (!isEditing && !newClientPass)) {
      setCreateClientError("Please fill in all required client credentials.");
      return;
    }

    const cleanUsername = newClientUser.trim().toLowerCase();

    // 1. Restrict username from being "admin"
    if (cleanUsername === "admin") {
      setCreateClientError("Username 'admin' is reserved and cannot be used.");
      return;
    }

    // 2. Enforce email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanUsername)) {
      setCreateClientError("Client username must be a valid email address (e.g. partner@corp.com).");
      return;
    }

    setIsCreatingClient(true);

    try {
      if (isEditing) {
        const bodyData: { id: string; org_name: string; username: string; password?: string } = {
          id: editingClientId,
          org_name: newClientOrg.trim(),
          username: cleanUsername,
        };
        if (newClientPass) {
          bodyData.password = newClientPass;
        }

        const response = await fetch("/api/admin/clients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to update partner workspace.");

        setClients((prev) => prev.map((c) => (c.id === editingClientId ? { ...c, ...data.client } : c)));
        setCreateClientSuccess(`Workspace updated for: ${data.client.org_name}`);
        
        // Reset inputs
        setNewClientOrg("");
        setNewClientUser("");
        setNewClientPass("");
        setEditingClientId(null);
      } else {
        const response = await fetch("/api/admin/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org_name: newClientOrg.trim(),
            username: cleanUsername,
            password: newClientPass,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        setClients((prev) => [data.client, ...prev]);
        setCreateClientSuccess(`Account created for: ${data.client.org_name}`);
        
        // Reset inputs
        setNewClientOrg("");
        setNewClientUser("");
        setNewClientPass("");
      }
    } catch (err) {
      setCreateClientError(err instanceof Error ? err.message : "Failed to save client workspace.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Delete  Client Workspace
  const handleDeleteClient = async (clientId: string, orgName: string) => {
    const confirmed = confirm(`Are you sure you want to permanently delete the partner workspace "${orgName}"?\nAll associated entrance requests and history logs will be permanently deleted from the system.`);
    if (!confirmed) return;

    try {
      const response = await fetch("/api/admin/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clientId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setClients((prev) => prev.filter((c) => c.id !== clientId));
      alert(`Workspace "${orgName}" has been successfully deleted.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to delete client: " + msg);
    }
  };



  // Toggle/Update  Client Status (Active/Suspended/Restricted)
  const handleUpdateClientStatus = async (clientId: string, newStatus: "active" | "suspended" | "restricted") => {
    try {
      const response = await fetch("/api/admin/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clientId,
          status: newStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Update clients state locally
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      );
      alert(`Client status updated to: ${newStatus.toUpperCase()}`);
    } catch (err) {
      alert("Failed to update client status: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Save Admin configurations (Alert emails, resource checklist filters)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    const joinedEmails = emailPills.join(", ");

    try {
      // 1. Save Admin Alert Emails
      const responseEmails = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "admin_notification_emails",
          value: joinedEmails,
        }),
      });

      if (!responseEmails.ok) {
        const errorData = await responseEmails.json();
        throw new Error(errorData.error || "Failed to save email settings.");
      }

      // 2. Save Allowed Resource Categories
      const responseCategories = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "allowed_resource_categories",
          value: JSON.stringify(settingsCategories),
        }),
      });

      if (!responseCategories.ok) {
        const errorData = await responseCategories.json();
        throw new Error(errorData.error || "Failed to save allowed categories.");
      }

      alert("Global configurations saved successfully.");
      setIsSidebarOpen(false); // Close mobile drawer on success
    } catch (err) {
      alert("Error saving configurations: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save Outgoing Email Signature details
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sigName.trim()) {
      alert("Please enter at least a signee officer name.");
      return;
    }
    setIsSavingSignature(true);

    try {
      // 1. Save Signature Name
      const responseSigName = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "admin_signature_name",
          value: sigName.trim(),
        }),
      });
      if (!responseSigName.ok) throw new Error("Failed to save signature name.");

      // 2. Save Signature Phone
      const responseSigPhone = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "admin_signature_phone",
          value: sigPhone.trim(),
        }),
      });
      if (!responseSigPhone.ok) throw new Error("Failed to save signature phone.");

      // 3. Save Signature Company
      const responseSigCompany = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "admin_signature_company",
          value: sigCompany.trim(),
        }),
      });
      if (!responseSigCompany.ok) throw new Error("Failed to save signature designation/company.");

      setIsEditingSignature(false);
      alert("Email signature details saved successfully.");
    } catch (err) {
      alert("Error saving signature: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Delete Outgoing Email Signature
  const handleDeleteSignature = async () => {
    const confirmed = confirm("Are you sure you want to permanently delete the outgoing email signature?");
    if (!confirmed) return;

    setIsSavingSignature(true);
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_signature_name", value: "" }),
      });
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_signature_phone", value: "" }),
      });
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "admin_signature_company", value: "" }),
      });

      setSigName("");
      setSigPhone("");
      setSigCompany("");
      setIsEditingSignature(false);
      alert("Email signature deleted successfully.");
    } catch (err) {
      alert("Failed to delete signature: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Process Approval/Denial Decision
  const handleProcessDecision = async (status: "approved" | "denied") => {
    if (!selectedRequest) return;
    if (status === "denied" && !denialReasonInput.trim()) {
      alert("Please provide a reason for declining entry.");
      return;
    }

    setIsDecisionLoading(true);
    setDecisionError(null);

    try {
      const response = await fetch("/api/admin/requests/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          status,
          denial_reason: status === "denied" ? denialReasonInput : null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Reset drawer inputs
      setShowDenyReasonForm(false);
      setDenialReasonInput("");

      // Update locally immediately (Realtime handles main updates, but this improves responsiveness)
      const updatedReq: AccessRequest = {
        ...selectedRequest,
        status,
        denial_reason: status === "denied" ? denialReasonInput : null,
      };
      setSelectedRequest(updatedReq);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Failed to submit entry decision.");
    } finally {
      setIsDecisionLoading(false);
    }
  };

  // Copy verification link for debugging/admin manual send
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  // Soft delete an access request
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);
  const handleDeleteRequest = async (requestId: string) => {
    const confirmed = confirm("Are you sure you want to delete this entrance request from records?");
    if (!confirmed) return;

    setIsDeletingRequest(true);
    try {
      const res = await fetch("/api/admin/requests/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete request");

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setSelectedRequest(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete request.";
      alert(errMsg);
    } finally {
      setIsDeletingRequest(false);
    }
  };

  // Filter requests logs
  const filteredRequests = requests.filter((req) => {
    if (req.is_deleted || req.deleted_at) return false;

    let matchesStatus = true;
    if (filterStatus === "pending") matchesStatus = req.status === "pending";
    else if (filterStatus === "approved") matchesStatus = req.status === "approved" && req.entered_at === null;
    else if (filterStatus === "denied") matchesStatus = req.status === "denied";
    else if (filterStatus === "inside") matchesStatus = req.entered_at !== null && req.exited_at === null;
    else if (filterStatus === "expired") matchesStatus = req.entered_at !== null && req.exited_at !== null;

    let matchesClient = true;
    if (selectedClientId !== "all") {
      matchesClient = req.client_id === selectedClientId;
    }

    const matchesSearch =
      req.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.pin_code.includes(searchTerm) ||
      req.clientOrgName.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesClient && matchesSearch;
  });

  // Export Filter Evaluator
  const getFilteredExportRequests = (): ExportableRequest[] => {
    return requests.filter((req) => {
      if (req.is_deleted || req.deleted_at) return false;
      // Date filter
      if (exportDateRange === "today") {
        const todayStr = new Date().toISOString().split("T")[0];
        if (req.expected_date !== todayStr) return false;
      } else if (exportDateRange === "week") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const reqDate = new Date(req.expected_date);
        if (reqDate < sevenDaysAgo) return false;
      } else if (exportDateRange === "month") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const reqDate = new Date(req.expected_date);
        if (reqDate < thirtyDaysAgo) return false;
      } else if (exportDateRange === "custom") {
        if (exportCustomStart && req.expected_date < exportCustomStart) return false;
        if (exportCustomEnd && req.expected_date > exportCustomEnd) return false;
      }

      // Partner filter
      if (exportPartnerId !== "all" && req.client_id !== exportPartnerId) {
        return false;
      }

      // Status filter
      if (exportStatus === "pending" && req.status !== "pending") return false;
      if (exportStatus === "approved" && !(req.status === "approved" && req.entered_at === null)) return false;
      if (exportStatus === "inside" && !(req.entered_at !== null && req.exited_at === null)) return false;
      if (exportStatus === "expired" && !(req.entered_at !== null && req.exited_at !== null)) return false;
      if (exportStatus === "denied" && req.status !== "denied") return false;

      return true;
    });
  };

  const handleExportExcel = () => {
    const dataToExport = getFilteredExportRequests();
    if (dataToExport.length === 0) {
      alert("No gate logs found matching the selected export filters.");
      return;
    }
    exportToExcel(dataToExport, "STARZS_Shipyard_Gate_Audit");
    setIsExportModalOpen(false);
  };

  const handleExportCSV = () => {
    const dataToExport = getFilteredExportRequests();
    if (dataToExport.length === 0) {
      alert("No gate logs found matching the selected export filters.");
      return;
    }
    exportToCSV(dataToExport, "STARZS_Shipyard_Gate_Audit");
    setIsExportModalOpen(false);
  };


  // Metrics Calculations
  const metricsPending = requests.filter((r) => r.status === "pending").length;
  const metricsInside = requests.filter((r) => r.entered_at !== null && r.exited_at === null).length;
  const metricsClients = clients.length;

  // Renders clients list, security guards registry, and settings (reused in desktop sidebar and mobile drawer)
  const renderClientsAndSettings = () => (
    <div className="space-y-5">
      {/* 1. Partner Accounts (Companies List & Form) */}
      <div className="bg-white border border-zinc-200 rounded p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary-blue" />
            Companies ({clients.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowClientForm(!showClientForm);
              if (showClientForm) {
                setEditingClientId(null);
                setNewClientOrg("");
                setNewClientUser("");
                setNewClientPass("");
                setCreateClientError(null);
                setCreateClientSuccess(null);
              }
            }}
            title={showClientForm || editingClientId ? "Close Form" : "Add New User"}
            className={`flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
              showClientForm || editingClientId
                ? "p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded"
                : "gap-1 px-2.5 py-1 bg-primary-dark hover:bg-primary-blue text-white rounded text-[11px] font-bold"
            }`}
          >
            {showClientForm || editingClientId ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Add New User
              </>
            )}
          </button>
        </div>

        {/* Companies List */}
        <div className="border border-zinc-200 rounded divide-y divide-zinc-200 max-h-[220px] overflow-y-auto pr-1 bg-white">
          {clients.length === 0 ? (
            <p className="text-zinc-400 text-[11px] italic text-center py-6">No company registered.</p>
          ) : (
            clients.map((client) => (
              <div key={client.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-zinc-800 block uppercase break-words">{client.org_name}</span>
                  <span className="text-[11px] text-zinc-500 font-mono block mt-0.5 break-all">{client.username}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={client.status}
                    onChange={(e) => handleUpdateClientStatus(client.id, e.target.value as "active" | "suspended" | "restricted")}
                    className={`text-[11px] font-bold py-0.5 px-2 border rounded focus:outline-none cursor-pointer ${
                      client.status === "active" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                      client.status === "suspended" ? "bg-rose-50 border-rose-300 text-rose-700" :
                      "bg-amber-50 border-amber-300 text-amber-700"
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="restricted">Restricted</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setNewClientOrg(client.org_name);
                      setNewClientUser(client.username);
                      setNewClientPass("");
                      setEditingClientId(client.id);
                      setShowClientForm(true);
                      setCreateClientError(null);
                      setCreateClientSuccess(null);
                    }}
                    title="Edit Company"
                    className="p-1 border border-zinc-200 hover:border-zinc-400 text-zinc-500 hover:text-zinc-800 rounded transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClient(client.id, client.org_name)}
                    title="Delete Account"
                    className="p-1 border border-rose-100 hover:border-destructive text-rose-400 hover:text-destructive rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create/Edit Client Inline Form (Toggled down) */}
        {(showClientForm || editingClientId) && (
          <form onSubmit={handleCreateClient} autoComplete="off" className="bg-zinc-50 border border-zinc-200 p-3.5 rounded space-y-2.5 pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-extrabold uppercase text-primary-blue tracking-wide">
                {editingClientId ? "Edit Company Account" : "Register New Partner Account"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setNewClientOrg("");
                  setNewClientUser("");
                  setNewClientPass("");
                  setEditingClientId(null);
                  setShowClientForm(false);
                  setCreateClientError(null);
                  setCreateClientSuccess(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded transition-colors cursor-pointer"
                title="Close Form"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {createClientError && (
              <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-2.5 py-1.5 rounded text-[11px] font-semibold">
                {createClientError}
              </div>
            )}
            {createClientSuccess && (
              <div className="bg-emerald-50 border-l-2 border-success text-success px-2.5 py-1.5 rounded text-[11px] font-semibold">
                {createClientSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                placeholder="Organization Name (e.g. SICL Corp)"
                value={newClientOrg}
                onChange={(e) => setNewClientOrg(e.target.value)}
                autoComplete="off"
                className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Login Email (e.g. info@sicl.com)"
                  value={newClientUser}
                  onChange={(e) => setNewClientUser(e.target.value)}
                  autoComplete="new-password"
                  className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  required
                />
                <input
                  type="password"
                  placeholder={editingClientId ? "New Password (Optional)" : "Account Password"}
                  value={newClientPass}
                  onChange={(e) => setNewClientPass(e.target.value)}
                  autoComplete="new-password"
                  className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  required={!editingClientId}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingClient}
              className="w-full bg-primary-blue hover:bg-primary-dark text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isCreatingClient ? "Creating account..." : editingClientId ? "Update account" : "+ Add New User"}
            </button>
          </form>
        )}
      </div>

      {/* 2. Security Guards Accounts (Active Guards Roster & Form) */}
      <div className="bg-white border border-zinc-200 rounded p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary-blue" />
            Active Guards Roster ({guards.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowGuardForm(!showGuardForm);
              if (showGuardForm) {
                setEditingGuardId(null);
                setGuardName("");
                setGuardPhone("");
                setGuardCode(generateGuardCode(guards));
                setGuardError(null);
              }
            }}
            title={showGuardForm || editingGuardId ? "Close Form" : "Add New Guard"}
            className={`flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
              showGuardForm || editingGuardId
                ? "p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded"
                : "gap-1 px-2.5 py-1 bg-primary-dark hover:bg-primary-blue text-white rounded text-[11px] font-bold"
            }`}
          >
            {showGuardForm || editingGuardId ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Add New Guard
              </>
            )}
          </button>
        </div>

        {/* Guards Listing */}
        <div className="border border-zinc-200 rounded divide-y divide-zinc-200 max-h-[220px] overflow-y-auto pr-1 bg-white">
          {guards.length === 0 ? (
            <p className="text-zinc-400 text-[11px] italic text-center py-6">No security guards registered.</p>
          ) : (
            guards.map((guard) => (
              <div key={guard.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-zinc-800 block uppercase break-words">{guard.name}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[11px] text-zinc-500 font-mono">
                    <span>{guard.phone}</span>
                    <span className="hidden sm:inline text-zinc-300">•</span>
                    <span className="bg-zinc-100 px-1.5 py-0.5 rounded font-bold text-[10px] text-zinc-700">Code: {guard.guard_code}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setGuardName(guard.name);
                      setGuardPhone(guard.phone);
                      setGuardCode(guard.guard_code);
                      setEditingGuardId(guard.id);
                      setShowGuardForm(true);
                      setGuardError(null);
                    }}
                    title="Edit Guard"
                    className="p-1 border border-zinc-200 hover:border-zinc-400 text-zinc-500 hover:text-zinc-800 rounded transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGuard(guard.id, guard.name)}
                    title="Delete Guard"
                    className="p-1 border border-rose-100 hover:border-destructive text-rose-400 hover:text-destructive rounded hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create/Edit Guard Inline Form (Toggled down) */}
        {(showGuardForm || editingGuardId) && (
          <form onSubmit={handleSaveGuard} autoComplete="off" className="bg-zinc-50 border border-zinc-200 p-3.5 rounded space-y-2.5 pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-extrabold uppercase text-primary-blue tracking-wide">
                {editingGuardId ? "Edit Guard Officer" : "Add Security Guard"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setGuardName("");
                  setGuardPhone("");
                  setGuardCode(generateGuardCode(guards));
                  setEditingGuardId(null);
                  setShowGuardForm(false);
                  setGuardError(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded transition-colors cursor-pointer"
                title="Close Form"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {guardError && (
              <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-2.5 py-1.5 rounded text-[11px] font-semibold">
                {guardError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                placeholder="Guard Full Name"
                value={guardName}
                onChange={(e) => setGuardName(e.target.value)}
                className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={guardPhone}
                  onChange={(e) => setGuardPhone(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  required
                />
                <div className="flex gap-1.5 w-full items-center">
                  <input
                    type="text"
                    placeholder="PIN"
                    value={guardCode}
                    readOnly
                    className="block w-28 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-500 font-mono font-bold cursor-not-allowed select-all"
                    title="This PIN code is automatically generated for security and uniqueness (4 numbers and 2 letters at the ending)."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newCode = generateGuardCode(guards);
                      setGuardCode(newCode);
                    }}
                    title="Rotate / Regenerate PIN Code"
                    className="px-2.5 py-1.5 border border-zinc-300 hover:border-primary-blue bg-white hover:bg-zinc-50 rounded text-zinc-600 hover:text-primary-blue transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingGuard}
              className="w-full bg-primary-blue hover:bg-primary-dark text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSavingGuard ? "Saving Officer..." : editingGuardId ? "Update Guard Officer" : "+ Register Guard Officer"}
            </button>
          </form>
        )}
      </div>
      {/* Sister Company Fleet Badges (PVC Cards) Section */}
      <div className="bg-white border border-zinc-200 rounded p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-primary-blue" />
            Sister Company Fleet Gate Badges ({cards.length})
          </h3>
          <button
            type="button"
            onClick={() => {
              setShowCardForm(!showCardForm);
              if (showCardForm) {
                setIssueCardError(null);
                setIssueClientId("");
                setIssueCardPin("");
              } else {
                setIssueClientId(clients[0]?.id || "");
              }
            }}
            title={showCardForm ? "Close Form" : "Issue New Badge"}
            className={`flex items-center justify-center transition-colors cursor-pointer shadow-xs ${
              showCardForm
                ? "p-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded"
                : "gap-1 px-2.5 py-1 bg-primary-dark hover:bg-primary-blue text-white rounded text-[11px] font-bold"
            }`}
          >
            {showCardForm ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Issue Badge
              </>
            )}
          </button>
        </div>

        <p className="text-zinc-500 text-[11px] leading-relaxed">
          Manage permanent PVC Gate Badges assigned to sister company vehicle fleets.
        </p>

        {/* Filter / Search for Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Search card number..."
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
          />
          <select
            value={cardFilterClient}
            onChange={(e) => setCardFilterClient(e.target.value)}
            className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="all">All Companies</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.org_name}
              </option>
            ))}
          </select>
        </div>

        {/* Cards list */}
        <div className="border border-zinc-200 rounded divide-y divide-zinc-200 max-h-[250px] overflow-y-auto pr-1 bg-white">
          {cards.filter((card) => {
            if (cardFilterClient !== "all" && card.client_id !== cardFilterClient) return false;
            if (cardSearch.trim()) {
              const q = cardSearch.toLowerCase();
              const matchNum = card.card_number.toLowerCase().includes(q);
              const matchOrg = (card.clientOrgName || "").toLowerCase().includes(q);
              if (!matchNum && !matchOrg) return false;
            }
            return true;
          }).length === 0 ? (
            <p className="text-zinc-400 text-[11px] italic text-center py-6">No fleet badges found matching filter.</p>
          ) : (
            cards
              .filter((card) => {
                if (cardFilterClient !== "all" && card.client_id !== cardFilterClient) return false;
                if (cardSearch.trim()) {
                  const q = cardSearch.toLowerCase();
                  const matchNum = card.card_number.toLowerCase().includes(q);
                  const matchOrg = (card.clientOrgName || "").toLowerCase().includes(q);
                  if (!matchNum && !matchOrg) return false;
                }
                return true;
              })
              .map((card) => {
                const isRevealed = !!revealedCardPins[card.id];
                return (
                  <div key={card.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-primary-dark uppercase">
                          {card.clientOrgName}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] font-mono">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-zinc-800">{card.card_number}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCardNum(card.card_number)}
                            title="Copy Card Number"
                            className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                          >
                            {copiedCardNum === card.card_number ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-zinc-300">•</span>
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-500">PIN:</span>
                          <span className="font-bold text-amber-600">
                            {isRevealed ? card.pin : "••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedCardPins((prev) => ({
                                ...prev,
                                [card.id]: !prev[card.id],
                              }))
                            }
                            className="text-zinc-400 hover:text-amber-600 cursor-pointer"
                          >
                            {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                      {/* Status select */}
                      <select
                        value={card.status}
                        onChange={(e) => handleUpdateCardStatus(card.id, e.target.value as "active" | "frozen" | "revoked")}
                        className={`text-[10px] font-bold py-0.5 px-1.5 border rounded focus:outline-none cursor-pointer ${
                          card.status === "active" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                          card.status === "frozen" ? "bg-amber-50 border-amber-300 text-amber-700" :
                          "bg-rose-50 border-rose-300 text-rose-700"
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="frozen">Frozen</option>
                        <option value="revoked">Revoked</option>
                      </select>

                      {/* Preview Badge */}
                      <button
                        type="button"
                        onClick={() => setPreviewCard(card)}
                        title="Preview Card Design"
                        className="p-1 border border-zinc-200 hover:border-primary-blue hover:text-primary-blue text-zinc-600 rounded transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Print PVC Badge */}
                      <a
                        href={`/card/${encodeURIComponent(card.card_number)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Print PVC Card"
                        className="p-1 border border-zinc-200 hover:border-zinc-400 text-zinc-600 hover:text-primary-dark rounded transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </a>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteCard(card.id)}
                        title="Delete Card"
                        className="p-1 border border-rose-100 hover:border-destructive text-rose-400 hover:text-destructive rounded hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Inline Issue Card Form */}
        {showCardForm && (
          <form onSubmit={handleIssueCard} autoComplete="off" className="bg-zinc-50 border border-zinc-200 p-3.5 rounded space-y-2.5 pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-extrabold uppercase text-primary-blue tracking-wide">
                Issue Sister Company Gate Badge
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowCardForm(false);
                  setIssueCardError(null);
                  setIssueClientId("");
                  setIssueCardPin("");
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded transition-colors cursor-pointer"
                title="Close Form"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {issueCardError && (
              <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-2.5 py-1.5 rounded text-[11px] font-semibold">
                {issueCardError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider mb-1">
                  Assign Sister Company
                </label>
                <select
                  value={issueClientId}
                  onChange={(e) => setIssueClientId(e.target.value)}
                  disabled={isIssuingCard}
                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-blue cursor-pointer"
                  required
                >
                  <option value="" disabled>Select Company Partner</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.org_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider mb-1">
                  4-Digit PIN (Leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  pattern="\d*"
                  placeholder="e.g. 5829 (Auto if empty)"
                  value={issueCardPin}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val) && val.length <= 4) {
                      setIssueCardPin(val);
                    }
                  }}
                  disabled={isIssuingCard}
                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary-blue text-primary-dark"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isIssuingCard}
              className="w-full bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              {isIssuingCard ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Issuing Badge...
                </>
              ) : (
                "+ Issue & Register Badge"
              )}
            </button>
          </form>
        )}
      </div>

      {/* System Settings Card */}
      <div className="bg-white border border-zinc-200 rounded p-4 sm:p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-primary-blue" />
          Global Settings & Categories
        </h3>
        
        <form onSubmit={handleSaveSettings} className="space-y-4">
          {/* Admin Notification Emails (Pill Builder) */}
          <div>
            <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide mb-1">
              Admin Alert Notification Emails
            </label>
            <p className="text-zinc-500 text-[11px] leading-relaxed mb-2">
              Add email addresses of administrative officers who should receive immediate email alerts when partners submit new facility entry requests.
            </p>
            
            {/* Interactive tag builder pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-50 border border-zinc-200 rounded min-h-[38px] mb-2 items-center">
              {emailPills.length === 0 ? (
                <span className="text-zinc-400 text-[11px] italic pl-1">No notification emails added.</span>
              ) : (
                emailPills.map((email) => (
                  <span 
                    key={email} 
                    className="inline-flex items-center gap-1 bg-primary-blue/10 border border-primary-blue/20 text-primary-dark font-bold text-[11px] px-2 py-0.5 rounded-sm shadow-xs"
                  >
                    {email}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveEmailPill(email)}
                      className="text-zinc-400 hover:text-destructive focus:outline-none font-bold text-xs shrink-0 pl-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            
            {/* Input with inline Add button */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="e.g. officer@starzs.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddEmailPill();
                  }
                }}
                className="block flex-1 px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue w-full"
              />
              <button
                type="button"
                onClick={() => handleAddEmailPill()}
                className="bg-primary-blue hover:bg-primary-dark text-white px-3 py-1.5 rounded font-bold text-[11px] transition-colors cursor-pointer w-full sm:w-auto shrink-0 shadow-xs"
              >
                Add Email
              </button>
            </div>
          </div>

          {/* Dynamic Resource Category Creator */}
          <div className="pt-3.5 border-t border-zinc-100">
            <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wide mb-1">
              Dynamic Resource Categories
            </label>
            <p className="text-zinc-500 text-[11px] leading-relaxed mb-2.5">
              Manage custom checklist resource categories.
            </p>
            
            {/* Active categories tags roster */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {settingsCategories.map((cat) => (
                <span 
                  key={cat} 
                  className="inline-flex items-center gap-1 bg-zinc-100 border border-zinc-200 text-zinc-800 font-bold text-[9px] uppercase px-2 py-0.5 rounded-sm shadow-xs"
                >
                  {cat}
                  <button 
                    type="button" 
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-zinc-400 hover:text-destructive focus:outline-none font-bold text-xs shrink-0 pl-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* Inline dynamic category creator */}
            <div className="flex flex-col sm:flex-row gap-2 bg-zinc-50 border border-zinc-200 p-2.5 rounded">
              <input
                type="text"
                placeholder="New Category (e.g. Vehicles, Tools)"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory(e);
                  }
                }}
                className="block flex-1 px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue w-full"
              />
              <button
                type="button"
                onClick={(e) => handleAddCategory(e)}
                className="bg-primary-dark hover:bg-primary-blue text-white px-3 py-1.5 rounded font-bold text-[11px] transition-colors cursor-pointer shrink-0 w-full sm:w-auto shadow-xs"
              >
                + Add Category
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            className="w-full bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isSavingSettings ? "Saving Settings..." : "Save Global Configurations"}
          </button>
        </form>
      </div>

      {/* Outgoing Email Signature Customizer Card */}
      <div className="bg-white border border-zinc-200 rounded p-4 sm:p-5 shadow-xs space-y-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-primary-blue" />
          Outgoing Email Signature Customizer
        </h3>
        
        {sigName.trim() && !isEditingSignature ? (
          /* PREVIEW MODE: Do not keep signature in input fields when saved */
          <div className="bg-zinc-50 border border-zinc-200 p-3.5 rounded space-y-3 font-sans">
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              Configure details that will be appended as a professional email signature block at the bottom of all dispatched notifications.
            </p>
            <div className="border-l-2 border-primary-blue pl-3 py-1 space-y-0.5 bg-white p-2.5 rounded-r shadow-xs">
              <p className="text-[10px] text-zinc-400 italic mb-0.5">Active signature block preview:</p>
              
              <p className="font-serif italic text-xs font-bold text-primary-dark tracking-wide">
                {sigName.toLowerCase().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
              </p>
              {sigCompany && (
                <p className="font-serif italic text-[11px] text-zinc-500 font-semibold mt-0.5">
                  {sigCompany.toLowerCase().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingSignature(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-300 hover:border-primary-blue hover:bg-white rounded text-[11px] font-bold text-zinc-600 transition-all cursor-pointer shadow-xs"
              >
                <Edit className="w-3 h-3 text-zinc-500" />
                Edit Signature
              </button>
              <button
                type="button"
                onClick={handleDeleteSignature}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-rose-200 hover:border-destructive text-rose-600 hover:bg-rose-50 rounded text-[11px] font-bold transition-all cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>
        ) : (
          /* EDIT MODE: Input fields for signature customizer. Only one signature can be added. */
          <form onSubmit={handleSaveSignature} className="space-y-3">
            <p className="text-zinc-500 text-[11px] leading-relaxed">
              Configure details that will be appended as a professional email signature block.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                placeholder="Signee Officer Name (e.g. Capt. Marcus Udoh)"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
                className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Contact Phone (e.g. +234-803-000-0000)"
                  value={sigPhone}
                  onChange={(e) => setSigPhone(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                />
                <input
                  type="text"
                  placeholder="Designation/Company (e.g. STARZS Ltd)"
                  value={sigCompany}
                  onChange={(e) => setSigCompany(e.target.value)}
                  className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {sigName.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSigName(initialSignatureName);
                    setSigPhone(initialSignaturePhone);
                    setSigCompany(initialSignatureCompany);
                    setIsEditingSignature(false);
                  }}
                  className="px-3 border border-zinc-300 hover:bg-zinc-100 text-zinc-600 rounded text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                  title="Cancel editing signature"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingSignature}
                className="flex-1 bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSavingSignature ? "Saving Signature..." : "Save Signature Settings"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-dull-white text-zinc-900 font-sans">
      
      {/* Top Header */}
      <DashboardHeader
        role="admin"
        onSignOut={handleSignOut}
        isSignOutLoading={isSignOutLoading}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Content Area - Table occupies 100% width, settings are in a side drawer overlay */}
      <main className="flex-1 p-6 overflow-y-auto max-w-[1600px] w-full mx-auto">
        <div className="space-y-6 flex flex-col h-full w-full">
          
          {/* Dashboard Title & Overview */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                Shipyard Access Control Dashboard
              </h1>
              <p className="text-xs md:text-sm text-zinc-500 font-medium mt-0.5">
                Overview of gate operations, active facility manifests, and partner company access.
              </p>
            </div>
          </div>

          {/* CONFIG DRAWER TRIGGER (Visible below xl screens, toggles drawer) */}
          <div>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-full xl:hidden bg-primary-blue hover:bg-primary-dark text-white text-sm font-bold py-3.5 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <Settings className="w-4 h-4" />
              Manage Partners & System Settings
            </button>
          </div>

          {/* Stats Badges Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Pending */}
            <div className="bg-white border border-zinc-200 rounded p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-zinc-400 text-[9px] font-extrabold uppercase tracking-wider block">Pending</span>
                <span className="text-2xl font-black text-amber-500 mt-1 block">{metricsPending}</span>
              </div>
              <div className="p-2 bg-amber-50 rounded text-amber-500 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            {/* Currently Inside */}
            <div className="bg-white border border-zinc-200 rounded p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-zinc-400 text-[9px] font-extrabold uppercase tracking-wider block">Inside</span>
                <span className="text-2xl font-black text-primary-blue mt-1 block">{metricsInside}</span>
              </div>
              <div className="p-2 bg-blue-50 rounded text-primary-blue shrink-0">
                <Activity className="w-4 h-4" />
              </div>
            </div>

            {/* Total Partners */}
            <div className="bg-white border border-zinc-200 rounded p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-zinc-400 text-[9px] font-extrabold uppercase tracking-wider block">Partners</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">{metricsClients}</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded text-emerald-600 shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Main Requests Board */}
          <div className="bg-white border border-zinc-200 rounded shadow-sm flex-1 flex flex-col overflow-hidden min-h-[400px]">
            {/* Table Control Panel */}
            <div className="px-6 py-4.5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold text-primary-dark uppercase tracking-wider">Visitors Logs</h2>
                <button
                  onClick={reloadRequests}
                  disabled={isRefreshing}
                  title="Refresh Logs"
                  className="p-1 text-zinc-500 hover:text-primary-blue border border-zinc-200 hover:border-zinc-300 rounded bg-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RotateCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-auto">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="block w-full sm:w-[180px] md:w-[210px] pl-8 pr-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  />
                </div>

                {/*  Client Dropdown Filter */}
                <div className="flex items-center gap-1.5 border border-zinc-300 rounded bg-white px-2.5 py-1.5 text-xs text-zinc-600 w-full sm:w-auto">
                  <Briefcase className="w-4 h-4 text-zinc-400" />
                  <select
                    value={selectedClientId}
                    onChange={(e) => { setSelectedClientId(e.target.value); setCurrentPage(1); }}
                    className="bg-transparent font-bold focus:outline-none cursor-pointer text-xs w-full sm:w-auto"
                  >
                    <option value="all">All  Partners</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.org_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 border border-zinc-300 rounded bg-white px-2.5 py-1.5 text-xs text-zinc-600 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-zinc-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value as "all" | "pending" | "approved" | "denied" | "inside" | "expired"); setCurrentPage(1); }}
                    className="bg-transparent font-bold focus:outline-none cursor-pointer text-xs w-full sm:w-auto"
                  >
                    <option value="all">All Request Lifecycles</option>
                    <option value="pending">Pending Admin Decision</option>
                    <option value="approved">Approved & Awaiting Gate</option>
                    <option value="inside">Currently Inside Facility</option>
                    <option value="expired">Expired (Checked Out)</option>
                    <option value="denied">Declined</option>
                  </select>
                </div>

                {/* Export Logs Button */}
                <button
                  type="button"
                  onClick={() => {
                    setExportPartnerId(selectedClientId);
                    setExportStatus(filterStatus);
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary-dark hover:bg-primary-blue text-white rounded font-bold text-xs transition-colors cursor-pointer shadow-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Logs
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 font-bold text-zinc-500 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">PIN / Ticket</th>
                    <th className="px-6 py-4"> Partner / Driver</th>
                    <th className="px-6 py-4 text-center">Entry Date</th>
                    <th className="px-6 py-4 text-center">Items</th>
                    <th className="px-6 py-4 text-center">Lifecycle Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-zinc-400 italic">
                        No requests match your search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.slice((currentPage - 1) * 10, currentPage * 10).map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-zinc-50/70 transition-colors cursor-pointer text-sm"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono font-extrabold text-primary-dark tracking-wide block text-sm">{req.pin_code}</span>
                          <span className="text-zinc-400 font-mono text-[10px] block tracking-tighter truncate max-w-[120px] mt-1">{req.ticket_number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-primary-blue block uppercase text-[10px] truncate max-w-[165px]">{req.clientOrgName}</span>
                          <span className="font-bold text-zinc-900 block truncate max-w-[165px] mt-1">{req.visitor_name}</span>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span className="font-semibold text-zinc-700">{req.expected_date}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {req.resources.length > 0 ? (
                            <span className="inline-flex flex-col items-center">
                              <span className="font-mono font-extrabold text-zinc-800 text-xs">
                                {req.resources.reduce((sum, r: ResourceItem) => sum + (r.quantity || 0), 0)}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5">
                                {req.resources.length} Type{req.resources.length > 1 ? 's' : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap text-xs">
                          {req.status === "pending" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-500 rounded-sm font-bold animate-pulse">
                              Pending Review
                            </span>
                          )}
                          {req.status === "cancelled" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-sm font-bold">
                              Cancelled
                            </span>
                          )}
                          {req.status === "denied" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 text-destructive rounded-sm font-bold">
                              Declined
                            </span>
                          )}
                          {req.status === "approved" && req.entered_at === null && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-sm font-bold">
                              Approved
                            </span>
                          )}
                          {req.entered_at !== null && req.exited_at === null && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-primary-blue rounded-sm font-bold">
                              Inside
                            </span>
                          )}
                          {req.entered_at !== null && req.exited_at !== null && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-400 rounded-sm font-bold">
                              Expired
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedRequest(req)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 hover:border-primary-blue hover:text-primary-blue hover:bg-zinc-50 rounded text-xs font-bold text-zinc-700 transition-colors cursor-pointer shadow-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredRequests.length > 10 && (
              <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between bg-zinc-50/50 text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0">
                <span>
                  Showing {Math.min((currentPage - 1) * 10 + 1, filteredRequests.length)} to {Math.min(currentPage * 10, filteredRequests.length)} of {filteredRequests.length} logs
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-zinc-300 rounded bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-zinc-750"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(filteredRequests.length / 10)))}
                    disabled={currentPage >= Math.ceil(filteredRequests.length / 10)}
                    className="px-3 py-1.5 border border-zinc-300 rounded bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-zinc-750"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* UNIFIED CONFIGURATION DRAWER OVERLAY (PC & Mobile overlay drawer) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[1.5px] z-50 flex items-center justify-start transition-all duration-300">
          <div className="bg-zinc-50 w-full max-w-md md:max-w-xl h-full border-r border-zinc-200 flex flex-col shadow-2xl overflow-y-auto p-6 animate-slide-in relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-blue" />
                <h3 className="text-xs font-black uppercase tracking-wider text-primary-dark">Partners & Configurations</h3>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-zinc-500 hover:text-zinc-900 p-1.5 border border-zinc-200 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {renderClientsAndSettings()}
          </div>
          {/* Clicking the backdrop area outside the drawer closes it */}
          <div className="flex-1 h-full cursor-pointer" onClick={() => setIsSidebarOpen(false)} />
        </div>
      )}

      {/* DETAIL MODAL DRAWER */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-lg h-full border-l border-zinc-200 flex flex-col shadow-2xl animate-slide-in">
            {/* Modal Header */}
            <div className="bg-primary-dark text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Review Entrance Request</span>
                <span className="text-xs font-mono font-bold text-white mt-0.5 block tracking-wide">
                  {selectedRequest.ticket_number}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteRequest(selectedRequest.id)}
                  disabled={isDeletingRequest}
                  title="Delete entrance request"
                  className="text-zinc-400 hover:text-rose-400 p-1.5 border border-zinc-800 rounded hover:bg-rose-950/40 hover:border-rose-800 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequest(null);
                    setShowDenyReasonForm(false);
                    setDenialReasonInput("");
                    setDecisionError(null);
                  }}
                  className="text-zinc-400 hover:text-white p-1.5 border border-zinc-800 rounded hover:bg-primary-blue transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {decisionError && (
                <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-3 py-2 rounded text-xs font-semibold">
                  {decisionError}
                </div>
              )}

              {/* Status Section */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-3 flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Request Status</span>
                <div className="text-xs font-bold uppercase">
                  {selectedRequest.status === "approved" && selectedRequest.entered_at === null && (
                    <span className="text-success flex items-center gap-1.5 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved Pass
                    </span>
                  )}
                  {selectedRequest.status === "pending" && (
                    <span className="text-amber-500 flex items-center gap-1.5 text-xs font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Pending Review
                    </span>
                  )}
                  {selectedRequest.status === "cancelled" && (
                    <span className="text-zinc-500 flex items-center gap-1.5 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5" /> Pass Cancelled
                    </span>
                  )}
                  {selectedRequest.status === "denied" && (
                    <span className="text-destructive flex items-center gap-1.5 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5" /> Request Declined
                    </span>
                  )}
                  {selectedRequest.entered_at !== null && selectedRequest.exited_at === null && (
                    <span className="text-primary-blue flex items-center gap-1.5 text-xs font-bold">
                      <Activity className="w-3.5 h-3.5" /> Inside Compound
                    </span>
                  )}
                  {selectedRequest.entered_at !== null && selectedRequest.exited_at !== null && (
                    <span className="text-zinc-400 flex items-center gap-1.5 text-xs font-bold">
                      <XCircle className="w-3.5 h-3.5" /> Expired (Used)
                    </span>
                  )}
                </div>
              </div>

              {/* Visitor Profile */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Visitor Profile</h4>
                <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white">
                  {/* Partner Company */}
                  <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Partner Company</span>
                      <span className="font-bold text-primary-blue uppercase text-xs">{selectedRequest.clientOrgName}</span>
                    </div>
                  </div>
                  {/* Name */}
                  <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                    <User className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Driver Name</span>
                      <span className="font-semibold text-zinc-800 text-xs">{selectedRequest.visitor_name}</span>
                    </div>
                  </div>

                  {/* Requesting Staff Tracing */}
                  {selectedRequest.requesting_staff_name && (
                    <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                      <User className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Requesting Staff</span>
                        <span className="font-semibold text-zinc-800 text-xs">{selectedRequest.requesting_staff_name}</span>
                      </div>
                    </div>
                  )}

                  {selectedRequest.requesting_staff_email && (
                    <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                      <Mail className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Requesting Email</span>
                        <span className="font-medium text-zinc-700 text-xs font-mono">{selectedRequest.requesting_staff_email}</span>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                    <Phone className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Phone Number</span>
                      <span className="font-medium text-zinc-700 text-xs font-mono">{selectedRequest.visitor_phone}</span>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Expected Arrival</span>
                      <span className="font-semibold text-zinc-800 text-xs flex items-center gap-2">
                        {selectedRequest.expected_date}
                        {selectedRequest.last_rescheduled_at && (
                          <span className="bg-blue-50 text-primary-blue text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-blue-100">
                            Rescheduled
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gate Auditing Timestamps */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Gate Auditing Logs</h4>
                <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white text-xs">
                  <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <span className="font-medium text-zinc-600 text-xs">Check-In:</span>
                    <div className="text-right">
                      <span className="font-mono text-zinc-800 font-semibold block text-xs">
                        {selectedRequest.entered_at ? new Date(selectedRequest.entered_at).toLocaleString() : "Not Checked In"}
                      </span>
                      {selectedRequest.entered_by && (
                        <span className="text-[10px] text-emerald-600 font-bold uppercase block mt-0.5">
                          Authorized by: {selectedRequest.entered_by}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <span className="font-medium text-zinc-600 text-xs">Check-Out:</span>
                    <div className="text-right">
                      <span className="font-mono text-zinc-800 font-semibold block text-xs">
                        {selectedRequest.exited_at ? new Date(selectedRequest.exited_at).toLocaleString() : "Not Checked Out"}
                      </span>
                      {selectedRequest.exited_by && (
                        <span className="text-[10px] text-rose-600 font-bold uppercase block mt-0.5">
                          Authorized by: {selectedRequest.exited_by}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource checklist */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Requested Checklist Items</h4>
                <div className="bg-zinc-50 border border-zinc-200 rounded p-3 space-y-2">
                  {selectedRequest.resources.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-800 font-medium border-b border-zinc-200/50 last:border-0 pb-2 last:pb-0">
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        item.category === "staff" ? "bg-emerald-100 text-emerald-800" :
                        item.category === "machinery" ? "bg-blue-100 text-blue-800" :
                        item.category === "materials" ? "bg-amber-100 text-amber-800" :
                        "bg-zinc-100 text-zinc-800"
                      }`}>
                        {item.category}
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-zinc-800">{item.quantity}x {item.type}</span>
                        {item.details && <span className="block text-xs text-zinc-500 font-normal mt-0.5">{item.details}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Denial Details (if denied) */}
              {selectedRequest.status === "denied" && selectedRequest.denial_reason && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Denial Details</h4>
                  <div className="bg-rose-50 border border-rose-200 text-destructive rounded p-3 text-xs font-medium leading-relaxed">
                    {selectedRequest.denial_reason}
                  </div>
                </div>
              )}

              {/* Scannable QR Code and Print Button (Only if Approved) */}
              {selectedRequest.status === "approved" && (
                <div className="pt-3 border-t border-zinc-100 flex flex-col items-center gap-2.5">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Gate Scan Pass</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      `${window.location.origin}/verify/${selectedRequest.ticket_number}`
                    )}`}
                    alt="Access Ticket QR Code"
                    width="140"
                    height="140"
                    className="border border-zinc-200 rounded p-1.5 bg-white"
                  />
                  <div className="flex gap-2.5 w-full">
                    <button
                      onClick={() => handleCopyText(`${window.location.origin}/verify/${selectedRequest.ticket_number}`)}
                      className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-xs font-bold py-2 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      {isCopied ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={`/ticket/${selectedRequest.ticket_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-primary-blue hover:bg-primary-dark text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1.5 transition-colors shadow-xs text-center cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Pass
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            {selectedRequest.status === "pending" && (
              <div className="border-t border-zinc-200 p-4 bg-zinc-50 space-y-3 shrink-0">
                {!showDenyReasonForm ? (
                  <div className="flex gap-3">
                    {/* Deny Option */}
                    <button
                      onClick={() => setShowDenyReasonForm(true)}
                      disabled={isDecisionLoading}
                      className="flex-1 border border-destructive/30 hover:border-destructive text-destructive hover:bg-rose-50 text-xs font-bold py-2.5 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Deny Entry
                    </button>
                    {/* Approve Option */}
                    <button
                      onClick={() => handleProcessDecision("approved")}
                      disabled={isDecisionLoading}
                      className="flex-1 bg-success hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      {isDecisionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Approve & Dispatch"
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <label htmlFor="denialReason" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Specify Reason for Denial
                    </label>
                    <textarea
                      id="denialReason"
                      rows={3}
                      value={denialReasonInput}
                      onChange={(e) => setDenialReasonInput(e.target.value)}
                      placeholder="e.g. Facility is undergoing maintenance, please reschedule for next week."
                      className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-destructive focus:border-destructive"
                      required
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDenyReasonForm(false);
                          setDenialReasonInput("");
                        }}
                        className="flex-1 border border-zinc-300 hover:bg-zinc-100 text-zinc-600 text-xs font-bold py-2 rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProcessDecision("denied")}
                        disabled={isDecisionLoading}
                        className="flex-1 bg-destructive hover:bg-rose-600 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isDecisionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Confirm Denial"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* AUDIT LOGS EXPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary-blue" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-primary-dark">
                  Export Gate Access Logs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Generate and download official gate security audit reports in Excel (.xlsx) or CSV format for compliance and operational reviews.
              </p>

              {/* Date Filter */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Date Range
                </label>
                <select
                  value={exportDateRange}
                  onChange={(e) => setExportDateRange(e.target.value as "all" | "today" | "week" | "month" | "custom")}
                  className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-blue"
                >
                  <option value="all">All Available Records</option>
                  <option value="today">Today Only</option>
                  <option value="week">Past 7 Days</option>
                  <option value="month">Past 30 Days</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Custom Date Inputs */}
              {exportDateRange === "custom" && (
                <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded border border-zinc-200">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">From Date</span>
                    <input
                      type="date"
                      value={exportCustomStart}
                      onChange={(e) => setExportCustomStart(e.target.value)}
                      className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">To Date</span>
                    <input
                      type="date"
                      value={exportCustomEnd}
                      onChange={(e) => setExportCustomEnd(e.target.value)}
                      className="block w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Partner Company Filter */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Partner / Company
                  </label>
                  <select
                    value={exportPartnerId}
                    onChange={(e) => setExportPartnerId(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  >
                    <option value="all">All Partners</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.org_name}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Lifecycle Status
                  </label>
                  <select
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value as "all" | "pending" | "approved" | "inside" | "expired" | "denied")}
                    className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Only</option>
                    <option value="approved">Approved / Awaiting Gate</option>
                    <option value="inside">Currently Inside Facility</option>
                    <option value="expired">Expired (Checked Out)</option>
                    <option value="denied">Declined</option>
                  </select>
                </div>
              </div>

              {/* Match Counter */}
              <div className="bg-primary-blue/5 border border-primary-blue/20 p-3 rounded flex items-center justify-between text-xs">
                <span className="text-zinc-600 font-medium">Matching records for export:</span>
                <span className="font-extrabold text-primary-dark font-mono text-sm">
                  {getFilteredExportRequests().length} records
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={getFilteredExportRequests().length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={getFilteredExportRequests().length === 0}
                className="flex-1 bg-primary-dark hover:bg-primary-blue text-white font-bold text-xs py-2.5 px-4 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                Export CSV (.csv)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SISTER COMPANY FLEET GATE BADGE PREVIEW MODAL */}
      {/* ========================================================= */}
      {previewCard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-6 my-auto text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-blue/20 text-blue-400 rounded-lg border border-primary-blue/30">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Sister Company Fleet Badge Preview
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    CR80 PVC Gate Badge for <strong className="text-amber-400">{previewCard.clientOrgName}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/card/${encodeURIComponent(previewCard.card_number)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-blue hover:bg-primary-dark text-white rounded text-xs font-bold transition-colors shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Badge
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewCard(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Badges Front & Back Showcase using centralized FleetGateCard */}
            <div className="py-2">
              <FleetGateCard 
                cardNumber={previewCard.card_number} 
                orgName={previewCard.clientOrgName || "Sister Company Partner"} 
              />
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewCard(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

