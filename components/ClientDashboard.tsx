/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, X, User, Phone, Calendar, Loader2, CheckCircle2, XCircle, 
  Search, Filter, Eye, Key, FileText, Printer, Activity, AlertTriangle, RotateCw, Mail,
  Download, FileSpreadsheet, CreditCard, Copy, Check, Lock, Unlock, EyeOff, Shield
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { exportToExcel, exportToCSV, ExportableRequest } from "@/lib/exportUtils";
import { encodeTicketSlug } from "@/lib/slug";
import DashboardHeader from "./DashboardHeader";


interface ResourceItem {
  category: "staff" | "machinery" | "materials" | "other";
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
}

interface AccessRequest {
  id: string;
  ticket_number: string;
  pin_code: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string;
  resources: ResourceItem[];
  expected_date: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  denial_reason: string | null;
  entered_at: string | null;
  exited_at: string | null;
  created_at: string;
  gate_notes?: string | null;
  last_rescheduled_at?: string | null;
  entered_by?: string | null;
  exited_by?: string | null;
  requesting_staff_name?: string;
  requesting_staff_email?: string;
}

interface SavedDriver {
  name: string;
  phone: string;
}

interface SavedStaff {
  name: string;
  email: string;
}

interface ClientDashboardProps {
  clientId: string;
  clientOrgName: string;
  clientUsername: string;
  clientStatus: "active" | "restricted";
  initialRequests: AccessRequest[];
  initialNotificationEmails: string[];
  allowedCategories: string[]; // E.g. ["staff", "machinery", "materials", "other"]
  initialCards?: CompanyCard[];
}

export default function ClientDashboard({
  clientId,
  clientOrgName,
  clientUsername: _clientUsername,
  clientStatus,
  initialRequests,
  allowedCategories,
  initialCards = [],
}: ClientDashboardProps) {
  const router = useRouter();

  // State Management
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  
  // History Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "denied" | "inside" | "expired">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Mobile Drawer State for Request Form & Settings
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);

  // Form State - Driver & Staff Info
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [requestingStaffName, setRequestingStaffName] = useState("");
  const [requestingStaffEmail, setRequestingStaffEmail] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Saved Autocomplete Profiles (Driver & Staff)
  const [savedDrivers, setSavedDrivers] = useState<SavedDriver[]>([]);
  const [savedStaff, setSavedStaff] = useState<SavedStaff[]>([]);

  // Form State - Resource Builder
  const [category, setCategory] = useState<"staff" | "machinery" | "materials" | "other">(
    (allowedCategories[0] as "staff" | "machinery" | "materials" | "other") || "machinery"
  );
  const [quantity, setQuantity] = useState<number | "">(1);
  const [resourceType, setResourceType] = useState(""); // E.g. "Technicians", "Excavator", "Cement"
  const [resourceDetails, setResourceDetails] = useState(""); // E.g. "Electrical Dept", "Model CAT 320D", "50kg bags"
  const [addedResources, setAddedResources] = useState<ResourceItem[]>([]);

  // Settings State (CC Emails disabled per new specifications)

  // Reschedule & Cancellation states
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleDateInput, setRescheduleDateInput] = useState("");
  const [isCancelLoading, setIsCancelLoading] = useState(false);
  const [isRescheduleLoading, setIsRescheduleLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reloads requests table client-side
  const reloadRequests = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("access_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        setRequests(data as AccessRequest[]);
      }
    } catch (err) {
      console.error("Failed to refresh table:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Real-time Supabase Subscription for Client Requests
  useEffect(() => {
    const channelName = `client_reqs_${clientId}_${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "access_requests",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newReq = payload.new as AccessRequest;
            setRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
          } else if (payload.eventType === "UPDATE") {
            const updatedReq = payload.new as AccessRequest;
            setRequests((prev) =>
              prev.map((req) => (req.id === updatedReq.id ? updatedReq : req))
            );
            setSelectedRequest((prev) =>
              prev && prev.id === updatedReq.id ? updatedReq : prev
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setRequests((prev) => prev.filter((req) => req.id !== deletedId));
            setSelectedRequest((prev) => (prev && prev.id === deletedId ? null : prev));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  // Select a request and reset rescheduling states
  const handleSelectRequest = (req: AccessRequest | null) => {
    setSelectedRequest(req);
    if (req) {
      setRescheduleDateInput(req.expected_date);
      setShowRescheduleForm(false);
    }
  };



  // Submission / Action States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  
  const [isCopied, setIsCopied] = useState(false);
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);

  // Tab State: "requests" (Access Requests) vs "cards" (Fleet Gate PVC Cards)
  const [activeTab, setActiveTab] = useState<"requests" | "cards">("requests");

  // Company Cards State
  const [cards, setCards] = useState<CompanyCard[]>(initialCards || []);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [cardLabelInput, setCardLabelInput] = useState("");
  const [cardPinInput, setCardPinInput] = useState("");
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [copiedCardNum, setCopiedCardNum] = useState<string | null>(null);

  // Reload cards
  const reloadCards = async () => {
    try {
      const res = await fetch("/api/client/cards");
      const data = await res.json();
      if (data.success && data.cards) {
        setCards(data.cards);
      }
    } catch (e) {
      console.error("Error reloading cards:", e);
    }
  };

  // Realtime subscription for requests
  useEffect(() => {
    const subscription = supabase
      .channel(`client_requests_${clientId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "access_requests",
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newReq = payload.new as AccessRequest;
            setRequests((prev) => [newReq, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedReq = payload.new as AccessRequest;
            setRequests((prev) =>
              prev.map((req) => (req.id === updatedReq.id ? updatedReq : req))
            );
            // Sync drawer details if currently selected
            setSelectedRequest((prev) =>
              prev && prev.id === updatedReq.id ? updatedReq : prev
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id: string }).id;
            setRequests((prev) => prev.filter((req) => req.id !== deletedId));
          }
        }
      )
      .subscribe();

    // Realtime subscription for company cards
    const cardSub = supabase
      .channel(`client_cards_${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_cards",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          reloadCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(cardSub);
    };
  }, [clientId]);

  // Load and merge saved drivers and staff from database profiles & historical requests
  const reloadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/client/profiles");
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.drivers)) setSavedDrivers(data.drivers);
        if (Array.isArray(data.staff)) setSavedStaff(data.staff);
      }
    } catch (e) {
      console.error("Error loading profiles from database:", e);
    }
  }, []);

  useEffect(() => {
    reloadProfiles();
  }, [reloadProfiles, clientId]);

  // Handle Driver selection / autocomplete
  const handleSelectDriver = (nameInput: string) => {
    setDriverName(nameInput);
    const matched = savedDrivers.find(
      (d) => d.name.toLowerCase() === nameInput.trim().toLowerCase()
    );
    if (matched && matched.phone) {
      setDriverPhone(matched.phone);
    }
  };

  // Handle Staff selection / autocomplete
  const handleSelectStaff = (staffInput: string) => {
    setRequestingStaffName(staffInput);
    const matched = savedStaff.find(
      (s) => s.name.toLowerCase() === staffInput.trim().toLowerCase()
    );
    if (matched && matched.email) {
      setRequestingStaffEmail(matched.email);
    }
  };

  // Add item to the temporary resources builder list
  const handleAddResource = (e: React.MouseEvent) => {
    e.preventDefault();
    const finalQuantity = typeof quantity === "number" ? quantity : 1;
    if (!resourceType.trim() || finalQuantity <= 0) return;

    const newItem: ResourceItem = {
      category,
      quantity: finalQuantity,
      type: resourceType.trim(),
      details: resourceDetails.trim(),
    };

    setAddedResources([...addedResources, newItem]);
    
    // Clear checklist error if present
    if (submitError && (submitError.toLowerCase().includes("checklist") || submitError.toLowerCase().includes("resource"))) {
      setSubmitError(null);
    }

    // Reset fields (keeping selected category)
    setQuantity(1);
    setResourceType("");
    setResourceDetails("");
  };
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError(null);
    setIsSavingCard(true);

    try {
      const res = await fetch("/api/client/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: cardLabelInput.trim() || "Fleet Vehicle Card",
          pin: cardPinInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create fleet card");

      if (data.card) {
        setCards((prev) => [data.card, ...prev]);
      }
      setIsCardModalOpen(false);
      setCardLabelInput("");
      setCardPinInput("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to issue card.";
      setCardError(errorMsg);
    } finally {
      setIsSavingCard(false);
    }
  };

  // Toggle card freeze / active
  const handleToggleCardStatus = async (cardId: string, currentStatus: "active" | "frozen" | "revoked") => {
    if (currentStatus === "revoked") return;
    const nextStatus = currentStatus === "active" ? "frozen" : "active";
    try {
      const res = await fetch("/api/client/cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        setCards((prev) => prev.map((c) => (c.id === cardId ? data.card : c)));
      }
    } catch (e) {
      console.error("Failed to toggle card status:", e);
    }
  };

  const handleCopyCardNumber = (cardNum: string) => {
    navigator.clipboard.writeText(cardNum);
    setCopiedCardNum(cardNum);
    setTimeout(() => setCopiedCardNum(null), 2000);
  };

  // Sign out  client
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

  // Remove item from temporary resources builder list
  const handleRemoveResource = (index: number) => {
    setAddedResources(addedResources.filter((_, idx) => idx !== index));
  };

  // (CC Settings disabled)

  // Submit request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (clientStatus === "restricted") {
      setSubmitError("Your account is restricted. You cannot submit new access requests.");
      return;
    }

    if (!requestingStaffName.trim()) {
      setSubmitError("Please enter the requesting  staff name.");
      return;
    }

    if (!driverName.trim() || !driverPhone.trim()) {
      setSubmitError("Please fill in all driver contact details.");
      return;
    }
    if (!expectedDate) {
      setSubmitError("Please select the expected entry date.");
      return;
    }
    if (addedResources.length === 0) {
      setSubmitError("Please add at least one resource (staff, machinery, or materials) to the checklist.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/client/requests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_name: driverName.trim(),
          visitor_email: "",
          visitor_phone: driverPhone.trim(),
          expected_date: expectedDate,
          resources: addedResources,
          requesting_staff_name: requestingStaffName.trim(),
          requesting_staff_email: requestingStaffEmail.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to submit request.");

      setSubmitSuccess(`Request submitted successfully! Ticket ID: ${data.ticket_number}`);
      
      // Persist newly entered driver & staff to localStorage
      try {
        const trimmedDriverName = driverName.trim();
        const trimmedDriverPhone = driverPhone.trim();
        if (trimmedDriverName) {
          const updatedDrivers = [
            { name: trimmedDriverName, phone: trimmedDriverPhone },
            ...savedDrivers.filter((d) => d.name.toLowerCase() !== trimmedDriverName.toLowerCase()),
          ];
          setSavedDrivers(updatedDrivers);
          localStorage.setItem(`starzs_saved_drivers_${clientId}`, JSON.stringify(updatedDrivers));
        }

        const trimmedStaffName = requestingStaffName.trim();
        const trimmedStaffEmail = requestingStaffEmail.trim();
        if (trimmedStaffName) {
          const updatedStaff = [
            { name: trimmedStaffName, email: trimmedStaffEmail },
            ...savedStaff.filter((s) => s.name.toLowerCase() !== trimmedStaffName.toLowerCase()),
          ];
          setSavedStaff(updatedStaff);
          localStorage.setItem(`starzs_saved_staff_${clientId}`, JSON.stringify(updatedStaff));
        }
      } catch (saveErr) {
        console.error("Failed to save profile cache:", saveErr);
      }

      // Reset forms
      setDriverName("");
      setDriverPhone("");
      setExpectedDate("");
      setAddedResources([]);
      setRequestingStaffName("");
      setRequestingStaffEmail("");
      
      // Instantly refresh the table and profiles on success
      reloadRequests();
      reloadProfiles();
      
      // Close mobile drawer on success
      setTimeout(() => {
        setIsFormDrawerOpen(false);
        setSubmitSuccess(null);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setSubmitError(errorMessage || "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter local requests logs
  const filteredRequests = requests.filter((req) => {
    let matchesStatus = true;
    if (filterStatus === "pending") matchesStatus = req.status === "pending";
    else if (filterStatus === "approved") matchesStatus = req.status === "approved" && req.entered_at === null;
    else if (filterStatus === "denied") matchesStatus = req.status === "denied";
    else if (filterStatus === "inside") matchesStatus = req.entered_at !== null && req.exited_at === null;
    else if (filterStatus === "expired") matchesStatus = req.entered_at !== null && req.exited_at !== null;

    const matchesSearch =
      req.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.pin_code.includes(searchTerm);

    return matchesStatus && matchesSearch;
  });

  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      alert("No requests found matching your current filters.");
      return;
    }
    const dataToExport: ExportableRequest[] = filteredRequests.map((r) => ({
      ...r,
      clientOrgName: clientOrgName,
    }));
    exportToExcel(dataToExport, `${clientOrgName.replace(/[\s/]/g, "_")}_Access_Logs`);
  };

  const handleExportCSV = () => {
    if (filteredRequests.length === 0) {
      alert("No requests found matching your current filters.");
      return;
    }
    const dataToExport: ExportableRequest[] = filteredRequests.map((r) => ({
      ...r,
      clientOrgName: clientOrgName,
    }));
    exportToCSV(dataToExport, `${clientOrgName.replace(/[\s/]/g, "_")}_Access_Logs`);
  };


  // Copy Ticket PIN or ID
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  // Cancel an approved or pending request
  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm("Are you sure you want to cancel this entry pass? This action cannot be undone.")) {
      return;
    }

    setIsCancelLoading(true);
    try {
      const response = await fetch("/api/client/requests/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Instantly update the state
      setRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: "cancelled" } : req))
      );

      // If the currently selected request is this one, update it in the details view
      setSelectedRequest((prev) =>
        prev && prev.id === requestId ? { ...prev, status: "cancelled" } : prev
      );

      alert("Entry pass cancelled successfully.");
      reloadRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Failed to cancel pass: " + errorMessage);
    } finally {
      setIsCancelLoading(false);
    }
  };

  // Reschedule an entry pass
  const handleRescheduleRequest = async (requestId: string, newDate: string) => {
    if (!newDate) {
      alert("Please select a valid new date.");
      return;
    }

    setIsRescheduleLoading(true);
    try {
      const response = await fetch("/api/client/requests/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          new_date: newDate,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Instantly update local state with the rescheduled ticket
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId
            ? {
                ...req,
                expected_date: newDate,
                last_rescheduled_at: new Date().toISOString(),
              }
            : req
        )
      );

      // Update selected request in drawer
      setSelectedRequest((prev) =>
        prev && prev.id === requestId
          ? {
              ...prev,
              expected_date: newDate,
              last_rescheduled_at: new Date().toISOString(),
            }
          : prev
      );

      alert("Entry pass rescheduled successfully.");
      setShowRescheduleForm(false);
      reloadRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Failed to reschedule pass: " + errorMessage);
    } finally {
      setIsRescheduleLoading(false);
    }
  };

  // Renders the form and settings (reused in desktop sidebar and mobile drawer)
  const renderFormAndSettings = () => (
    <div className="space-y-6">
      {/* Main Access Request Form */}
      <div className="bg-white border border-zinc-200 rounded p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-blue" />
          Register Compound Entry
        </h2>

        {clientStatus === "restricted" && (
          <div className="bg-amber-50 border-l-2 border-amber-500 p-4 rounded mb-5 text-xs text-amber-800 font-semibold leading-normal">
            Your account is currently restricted. You can view your logs and download tickets, but you cannot submit new access requests.
          </div>
        )}

        <form onSubmit={handleSubmitRequest} className="space-y-4">
          {submitError && !submitError.toLowerCase().includes("checklist") && !submitError.toLowerCase().includes("resource") && (
            <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-3 py-2.5 rounded text-xs font-bold leading-normal">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="bg-emerald-50 border-l-2 border-success text-success px-3 py-2.5 rounded text-xs font-bold leading-normal">
              {submitSuccess}
            </div>
          )}

          {/* Read Only Organization */}
          <div>
            <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5">
              Registered Organization (Locked)
            </label>
            <input
              type="text"
              value={clientOrgName}
              disabled
              className="block w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded text-sm text-zinc-500 font-bold"
            />
          </div>

          {/* Requesting Staff Info */}
          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase text-primary-blue tracking-wide">Requesting Staff Details</h4>
              {savedStaff.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectStaff(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  disabled={clientStatus === "restricted" || isSubmitting}
                  className="text-[10px] font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-blue cursor-pointer max-w-[170px] truncate"
                  title="Quick select saved staff"
                >
                  <option value="" disabled>Saved Staff ({savedStaff.length})</option>
                  {savedStaff.map((s, idx) => (
                    <option key={idx} value={s.name}>
                      {s.name} {s.email ? `(${s.email})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <input
                type="text"
                list="saved-staff-datalist"
                placeholder="Requesting Staff Full Name (Required)"
                value={requestingStaffName}
                onChange={(e) => handleSelectStaff(e.target.value)}
                onBlur={() => {
                  const matched = savedStaff.find(
                    (s) => s.name.toLowerCase() === requestingStaffName.trim().toLowerCase()
                  );
                  if (matched && matched.email && !requestingStaffEmail) {
                    setRequestingStaffEmail(matched.email);
                  }
                }}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-200 rounded text-sm placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
              <datalist id="saved-staff-datalist">
                {savedStaff.map((s, idx) => (
                  <option key={idx} value={s.name}>
                    {s.email ? `Email: ${s.email}` : s.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <input
                type="email"
                placeholder="Requesting Staff Email (Optional - For notifications)"
                value={requestingStaffEmail}
                onChange={(e) => setRequestingStaffEmail(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-200 rounded text-sm placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
              />
            </div>
          </div>

          {/* Driver/Visitor Info */}
          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase text-primary-blue tracking-wide">Driver / Visitor Details</h4>
              {savedDrivers.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectDriver(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  disabled={clientStatus === "restricted" || isSubmitting}
                  className="text-[10px] font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-blue cursor-pointer max-w-[170px] truncate"
                  title="Quick select saved driver"
                >
                  <option value="" disabled>Saved Drivers ({savedDrivers.length})</option>
                  {savedDrivers.map((d, idx) => (
                    <option key={idx} value={d.name}>
                      {d.name} {d.phone ? `(${d.phone})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div>
              <input
                type="text"
                list="saved-driver-datalist"
                placeholder="Driver's Full Name"
                value={driverName}
                onChange={(e) => handleSelectDriver(e.target.value)}
                onBlur={() => {
                  const matched = savedDrivers.find(
                    (d) => d.name.toLowerCase() === driverName.trim().toLowerCase()
                  );
                  if (matched && matched.phone && !driverPhone) {
                    setDriverPhone(matched.phone);
                  }
                }}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
              <datalist id="saved-driver-datalist">
                {savedDrivers.map((d, idx) => (
                  <option key={idx} value={d.name}>
                    {d.phone ? `Phone: ${d.phone}` : d.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                type="tel"
                placeholder="Driver Phone Number"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5">Expected Entry Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                min={new Date().toLocaleDateString("en-CA")}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm placeholder:text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
            </div>
          </div>

          {/* Dynamic Resource Checklist Builder */}
          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <h4 className="text-xs font-extrabold uppercase text-primary-blue tracking-wide">Access Resources Checklist</h4>
            
            {submitError && (submitError.toLowerCase().includes("checklist") || submitError.toLowerCase().includes("resource")) && (
              <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-3 py-2.5 rounded text-xs font-bold leading-normal">
                {submitError}
              </div>
            )}
            
            <div className="bg-zinc-50 border border-zinc-200 rounded p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Category Selector */}
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as "staff" | "machinery" | "materials" | "other")}
                    disabled={clientStatus === "restricted" || isSubmitting}
                    className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  >
                    {allowedCategories.includes("machinery") && <option value="machinery">Machinery</option>}
                    {allowedCategories.includes("staff") && <option value="staff">Staff/Labor</option>}
                    {allowedCategories.includes("materials") && <option value="materials">Materials</option>}
                    {allowedCategories.includes("other") && <option value="other">Other</option>}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Quantity</span>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={clientStatus === "restricted" || isSubmitting}
                    className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  />
                </div>
              </div>

              {/* Dynamic inputs based on Category */}
              <div className="grid grid-cols-1 gap-2">
                {category === "staff" ? (
                  <>
                    <input
                      type="text"
                      placeholder="Role (e.g. Electrician, Installer)"
                      value={resourceType}
                      onChange={(e) => setResourceType(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                    <input
                      type="text"
                      placeholder="Department / Project Details"
                      value={resourceDetails}
                      onChange={(e) => setResourceDetails(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </>
                ) : category === "machinery" ? (
                  <>
                    <input
                      type="text"
                      placeholder="Model / Equipment Name (e.g. CAT Excavator)"
                      value={resourceType}
                      onChange={(e) => setResourceType(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                    <input
                      type="text"
                      placeholder="Serial Number / ID Tags (Optional)"
                      value={resourceDetails}
                      onChange={(e) => setResourceDetails(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Item Name (e.g. Cement Bags, Steel Pipes)"
                      value={resourceType}
                      onChange={(e) => setResourceType(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                    <input
                      type="text"
                      placeholder="Descriptions / Dimensions / Specs"
                      value={resourceDetails}
                      onChange={(e) => setResourceDetails(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddResource}
                disabled={clientStatus === "restricted" || !resourceType.trim()}
                className="w-full bg-primary-blue hover:bg-primary-dark text-white text-xs md:text-sm font-bold py-2 md:py-2.5 rounded transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                + Add Item to Request
              </button>
            </div>

            {/* Added resources list */}
            <div className="border border-zinc-200 rounded p-4 min-h-[100px] bg-zinc-50 space-y-2">
              {addedResources.length === 0 ? (
                <p className="text-zinc-400 text-xs italic text-center py-6">Checklist is empty. Add items above.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {addedResources.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border border-zinc-200 text-zinc-800 px-3 py-2 rounded text-xs font-bold shadow-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded-sm shrink-0 font-black ${
                          item.category === "staff" ? "bg-emerald-100 text-emerald-800" :
                          item.category === "machinery" ? "bg-blue-100 text-blue-800" :
                          item.category === "materials" ? "bg-amber-100 text-amber-800" :
                          "bg-zinc-100 text-zinc-800"
                        }`}>
                          {item.category}
                        </span>
                        <span className="truncate">{item.quantity}x {item.type} {item.details && `(${item.details})`}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveResource(idx)}
                        className="text-zinc-400 hover:text-destructive transition-colors focus:outline-none ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Submit Request Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={clientStatus === "restricted" || isSubmitting}
              className="w-full bg-primary-dark hover:bg-primary-blue text-white text-sm font-bold py-3 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registering Entry...
                </>
              ) : (
                "Submit Entry for Approval"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-dull-white text-zinc-900 font-sans">
      
      {/* Top Header */}
      <DashboardHeader
        role="client"
        clientStatus={clientStatus}
        onSignOut={handleSignOut}
        isSignOutLoading={isSignOutLoading}
      />

      {/* Sub-Header Navigation Tabs */}
      <div className="bg-white border-b border-zinc-200 px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "requests"
                ? "bg-primary-dark text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Access Requests ({requests.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "cards"
                ? "bg-primary-dark text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Fleet Gate Badges ({cards.length})
          </button>
        </div>

        {activeTab === "cards" && (
          <button
            type="button"
            onClick={() => {
              setCardError(null);
              setCardLabelInput("");
              setCardPinInput("");
              setIsCardModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-blue hover:bg-primary-dark text-white rounded font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Issue Fleet Badge
          </button>
        )}
      </div>

      {/* Main Responsive Layout */}
      {activeTab === "requests" ? (
        <main className="flex-1 p-6 overflow-y-auto max-w-[1600px] w-full mx-auto space-y-6">
          {/* Dashboard Title & Overview */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {clientOrgName} Partner Portal
              </h1>
              <p className="text-xs md:text-sm text-zinc-500 font-medium mt-0.5">
                Submit access manifests and monitor gate approval logs in real-time.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* DESKTOP SIDEBAR: Form & Settings (Visible only on xl screens) */}
            <div className="xl:col-span-2 hidden xl:block">
              {renderFormAndSettings()}
            </div>

          {/* RIGHT COLUMN: Requests logs history table */}
          <div className="xl:col-span-3 space-y-6 flex flex-col h-full">
            
            {/* MOBILE TOGGLE TRIGGER BUTTON (Visible only below xl screens) */}
            <div className="xl:hidden">
              <button
                onClick={() => setIsFormDrawerOpen(true)}
                className="w-full bg-primary-blue hover:bg-primary-dark text-white text-sm font-bold py-3.5 rounded flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                New Entry Request & Settings
              </button>
            </div>

            <div className="bg-white border border-zinc-200 rounded shadow-sm flex-1 flex flex-col overflow-hidden min-h-[500px]">
              
              {/* Table Control Panel */}
              <div className="px-6 py-4.5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-bold text-primary-dark uppercase tracking-wider">Compound Access Logs</h2>
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
                      className="block w-full sm:w-[180px] md:w-[210px] pl-8 pr-3 py-1.5 bg-white border border-zinc-300 rounded text-xs placeholder:text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-1.5 border border-zinc-300 rounded bg-white px-2.5 py-1.5 text-xs text-zinc-600 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-zinc-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => { setFilterStatus(e.target.value as "all" | "pending" | "approved" | "denied" | "inside" | "expired"); setCurrentPage(1); }}
                      className="bg-transparent font-bold focus:outline-none cursor-pointer text-xs w-full sm:w-auto"
                    >
                      <option value="all">All Logs</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="inside">Checked In (Inside Facility)</option>
                      <option value="expired">Expired (Used)</option>
                      <option value="denied">Declined</option>
                    </select>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      disabled={filteredRequests.length === 0}
                      title="Export logs to Excel"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Excel
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      disabled={filteredRequests.length === 0}
                      title="Export logs to CSV"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-dark hover:bg-primary-blue text-white rounded font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                  <thead className="bg-zinc-50 font-bold text-zinc-500 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-6 py-4">PIN / Ticket</th>
                      <th className="px-6 py-4">Driver Details</th>
                      <th className="px-6 py-4 text-center">Scheduled Date</th>
                      <th className="px-6 py-4 text-center">Items</th>
                      <th className="px-6 py-4 text-center">Gate Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                        {filteredRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-16 text-center text-zinc-400 italic">
                              No requests found matching your filters.
                            </td>
                          </tr>
                        ) : (
                          filteredRequests.slice((currentPage - 1) * 10, currentPage * 10).map((req) => (
                            <tr
                              key={req.id}
                              className="hover:bg-zinc-50/70 transition-colors cursor-pointer text-sm"
                              onClick={() => handleSelectRequest(req)}
                            >
                          <td className="px-6 py-4">
                            <span className="font-mono font-extrabold text-primary-dark tracking-wide block text-sm">{req.pin_code}</span>
                            <span className="text-zinc-400 font-mono text-[10px] block tracking-tighter truncate max-w-[120px] mt-1">{req.ticket_number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-zinc-900 block text-sm">{req.visitor_name}</span>
                            <span className="text-zinc-500 text-xs block mt-1 font-mono">{req.visitor_phone}</span>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className="font-semibold text-zinc-700">{req.expected_date}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {req.resources.length > 0 ? (
                              <span className="inline-flex flex-col items-center">
                                <span className="font-mono font-extrabold text-zinc-800 text-xs">
                                  {req.resources.reduce((sum, r) => sum + (r.quantity || 0), 0)}
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-500 rounded-sm font-bold">
                                Pending
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
                                Checked In
                              </span>
                            )}
                            {req.entered_at !== null && req.exited_at !== null && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-600 rounded-sm font-bold">
                                Expired (Used)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectRequest(req); }}
                              className="text-xs font-bold text-primary-blue hover:text-primary-dark transition-colors"
                            >
                              View &rarr;
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Controls */}
              {filteredRequests.length > 10 && (
                <div className="px-6 py-3 border-t border-zinc-200 flex items-center justify-between text-xs bg-zinc-50">
                  <span className="text-zinc-500 font-semibold">
                    Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filteredRequests.length)} of {filteredRequests.length} requests
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-white border border-zinc-300 rounded text-zinc-700 font-bold hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="font-bold text-zinc-800">Page {currentPage} of {Math.ceil(filteredRequests.length / 10)}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredRequests.length / 10), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredRequests.length / 10)}
                      className="px-3 py-1 bg-white border border-zinc-300 rounded text-zinc-700 font-bold hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
          </div>
        </main>
      ) : (
        /* ========================================================= */
        /* FLEET GATE BADGES (PVC CARDS) VIEW */
        /* ========================================================= */
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto space-y-6">
          {/* Dashboard Title & Overview */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {clientOrgName} Fleet Badges
              </h1>
              <p className="text-xs md:text-sm text-zinc-500 font-medium mt-0.5">
                Manage permanent PVC cards for authorized company drivers and vehicles.
              </p>
            </div>
          </div>
          
          {/* Explanation Banner */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary-dark flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-blue" />
                Permanent Fleet & Company Gate Badges
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-3xl">
                PVC Fleet Badges allow any of your authorized drivers to access the shipyard gate without printing single-use passes or waiting for SMS codes. When a driver presents an active card at the gate, they simply enter the <strong>4-digit Card PIN</strong> to check in today&apos;s approved trips.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setCardError(null);
                setCardLabelInput("");
                setCardPinInput("");
                setIsCardModalOpen(true);
              }}
              className="px-4 py-2.5 bg-primary-dark hover:bg-primary-blue text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-md shrink-0"
            >
              <Plus className="w-4 h-4" />
              Issue New Fleet Card
            </button>
          </div>

          {/* Cards Grid */}
          {cards.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
              <CreditCard className="w-12 h-12 text-zinc-300 mx-auto" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700">No Fleet Badges Issued Yet</h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Generate permanent PVC Gate Cards for your trucks, operations vehicles, or field dispatchers.
              </p>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary-blue hover:bg-primary-dark text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Generate First Fleet Card
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card) => {
                const isPinRevealed = !!revealedPins[card.id];
                const isFrozen = card.status === "frozen";
                const isRevoked = card.status === "revoked";

                return (
                  <div
                    key={card.id}
                    className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                      isRevoked
                        ? "border-rose-300 opacity-60"
                        : isFrozen
                        ? "border-amber-300"
                        : "border-zinc-200"
                    }`}
                  >
                    {/* Visual PVC Card Preview Top */}
                    <div className="p-4 bg-gradient-to-br from-[#0b023b] via-[#11035E] to-[#060122] text-white relative overflow-hidden rounded-t-xl border-b border-white/10 flex flex-col justify-between h-[180px]">
                      {/* Geometric Circles Texture matching reference */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(99,102,241,0.18)_0%,transparent_50%)] pointer-events-none"></div>
                      <div className="absolute top-1 right-8 w-20 h-20 rounded-full border border-white/10 pointer-events-none"></div>

                      <div className="flex items-start justify-between relative z-10">
                        <div className="text-[8px] font-mono tracking-widest text-blue-200/70 uppercase">
                          STARZS ACCESS
                        </div>
                        <div className="flex flex-col items-end">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/image.png"
                            alt="Starzs"
                            className="h-6 w-auto object-contain brightness-110 drop-shadow"
                          />
                          <span className="text-[7px] font-black uppercase tracking-widest text-amber-400 mt-0.5">
                            GATE PASS
                          </span>
                        </div>
                      </div>

                      <div className="relative z-10 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-8 h-5 rounded bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-500 border border-amber-600/50 shadow-inner flex flex-col justify-between p-0.5 shrink-0">
                            <div className="w-full h-0.5 bg-amber-700/30 rounded-full"></div>
                            <div className="w-full h-0.5 bg-amber-700/30 rounded-full"></div>
                          </div>
                          <span className="text-white/60 text-[10px] font-mono">))))</span>
                        </div>

                        <div>
                          <span className="text-[7px] font-bold text-blue-200/80 uppercase tracking-widest block">
                            CARD NUMBER
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-xs font-black text-white tracking-[0.14em]">
                              {card.card_number}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCardNumber(card.card_number)}
                              title="Copy Card Number"
                              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                              {copiedCardNum === card.card_number ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="-mx-4 -mb-4 bg-black/90 px-4 py-1.5 flex items-center justify-between border-t border-white/10 relative z-10">
                        <span className="font-bold text-[11px] text-amber-300 uppercase tracking-wide truncate max-w-[160px]">
                          {clientOrgName}
                        </span>
                        <span className="text-[7px] font-mono text-zinc-400 uppercase tracking-widest">
                          SMEL-CR80
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Bottom */}
                    <div className="p-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">PIN:</span>
                        <span className="font-mono text-xs font-black text-amber-600 tracking-widest">
                          {isPinRevealed ? card.pin : "••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedPins((prev) => ({
                              ...prev,
                              [card.id]: !prev[card.id],
                            }))
                          }
                          className="text-zinc-400 hover:text-amber-600 transition-colors cursor-pointer"
                          title={isPinRevealed ? "Hide PIN" : "Reveal PIN"}
                        >
                          {isPinRevealed ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/card/${encodeURIComponent(card.card_number)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-dark hover:bg-primary-blue text-white rounded text-xs font-bold transition-colors shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </a>

                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => handleToggleCardStatus(card.id, card.status)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 border rounded text-xs font-bold transition-colors cursor-pointer ${
                              isFrozen
                                ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                            }`}
                          >
                            {isFrozen ? (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                Unfreeze
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                Freeze
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </main>
      )}

      {/* ========================================================= */}
      {/* ISSUE NEW FLEET CARD MODAL */}
      {/* ========================================================= */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-primary-blue rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary-dark">
                    Issue New Fleet Gate Badge
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase">{clientOrgName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="space-y-4">
              {cardError && (
                <div className="p-3 bg-rose-50 border-l-2 border-destructive text-destructive text-xs font-semibold rounded">
                  {cardError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider mb-1">
                  Card Label / Vehicle Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. Haulage Truck 01 or Operations Van"
                  value={cardLabelInput}
                  onChange={(e) => setCardLabelInput(e.target.value)}
                  disabled={isSavingCard}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded text-xs placeholder:text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-primary-blue"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-400 tracking-wider mb-1">
                  4-Digit Card PIN (Optional - Leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  pattern="\d*"
                  placeholder="e.g. 5829"
                  value={cardPinInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val) && val.length <= 4) {
                      setCardPinInput(val);
                    }
                  }}
                  disabled={isSavingCard}
                  className="w-full text-center tracking-widest font-mono text-lg font-black px-3 py-2 bg-zinc-50 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-blue text-primary-dark"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-[11px] text-blue-900 leading-relaxed">
                A unique QR code and permanent badge number will be generated. You can immediately print this badge or download the CR80 PDF layout.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingCard}
                  className="flex-1 bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-2.5 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingCard ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Badge...
                    </>
                  ) : (
                    "Create & Issue Badge"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  disabled={isSavingCard}
                  className="px-4 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE FORM & CONFIG DRAWER Overlay */}
      {isFormDrawerOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 flex items-center justify-start xl:hidden">
          <div className="bg-dull-white w-full max-w-md h-full border-r border-zinc-200 flex flex-col shadow-2xl overflow-y-auto p-6 animate-slide-in">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 mb-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-primary-dark">Workspace Submissions</h3>
              <button
                onClick={() => setIsFormDrawerOpen(false)}
                className="text-zinc-500 hover:text-zinc-900 p-1.5 border border-zinc-200 rounded hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {renderFormAndSettings()}
          </div>
        </div>
      )}

      {/* CLIENT REQUEST DETAILS DRAWER (Symmetrical to Admin Side) */}
      {selectedRequest && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 flex items-center justify-end cursor-pointer"
          onClick={() => handleSelectRequest(null)}
        >
          <div 
            className="bg-white w-full max-w-lg h-full border-l border-zinc-200 flex flex-col shadow-2xl animate-slide-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Drawer Header */}
            <div className="bg-primary-dark text-white px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Gate Pass Details</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono font-bold text-white tracking-wide">{selectedRequest.pin_code}</span>
                  <span className="text-zinc-400 font-mono text-xs">/ {selectedRequest.ticket_number}</span>
                </div>
              </div>
              <button
                onClick={() => handleSelectRequest(null)}
                className="text-zinc-400 hover:text-white p-1.5 border border-zinc-800 rounded hover:bg-primary-blue transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Lifecycle Status Box */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-3 flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Gate Status</span>
                <div className="text-xs font-bold uppercase">
                  {selectedRequest.status === "pending" && (
                    <span className="text-amber-500 flex items-center gap-1.5 font-bold text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" /> Pending Approval
                    </span>
                  )}
                  {selectedRequest.status === "cancelled" && (
                    <span className="text-zinc-500 flex items-center gap-1.5 font-bold text-xs">
                      <XCircle className="w-3.5 h-3.5" /> Pass Cancelled
                    </span>
                  )}
                  {selectedRequest.status === "denied" && (
                    <span className="text-destructive flex items-center gap-1.5 font-bold text-xs">
                      <XCircle className="w-3.5 h-3.5" /> Request Declined
                    </span>
                  )}
                  {selectedRequest.status === "approved" && selectedRequest.entered_at === null && (
                    <span className="text-success flex items-center gap-1.5 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved - Ready
                    </span>
                  )}
                  {selectedRequest.entered_at !== null && selectedRequest.exited_at === null && (
                    <span className="text-primary-blue flex items-center gap-1.5 font-bold text-xs">
                      <Activity className="w-3.5 h-3.5" /> Checked In
                    </span>
                  )}
                  {selectedRequest.entered_at !== null && selectedRequest.exited_at !== null && (
                    <span className="text-zinc-400 flex items-center gap-1.5 font-bold text-xs">
                      <XCircle className="w-3.5 h-3.5" /> Pass Expired (Used)
                    </span>
                  )}
                </div>
              </div>

              {/* Visitor / Driver Profile */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Visitor Profile</h4>
                <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white">
                  <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                    <User className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Driver Name</span>
                      <span className="font-semibold text-zinc-800 text-xs">{selectedRequest.visitor_name}</span>
                    </div>
                  </div>

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

                  <div className="px-3.5 py-2.5 flex items-start gap-3 text-xs">
                    <Phone className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase tracking-wider">Phone Number</span>
                      <span className="font-medium text-zinc-700 text-xs font-mono">{selectedRequest.visitor_phone}</span>
                    </div>
                  </div>
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
                          Authorized by: {selectedRequest.entered_by.replace(/\s*\([^)]*\)/g, "").trim()}
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
                          Authorized by: {selectedRequest.exited_by.replace(/\s*\([^)]*\)/g, "").trim()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource checklist */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Requested Resources Checklist</h4>
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

              {/* Decline reason if denied */}
              {selectedRequest.status === "denied" && selectedRequest.denial_reason && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Reason for Denial</h4>
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
                      `${window.location.origin}/verify/${encodeTicketSlug(selectedRequest.ticket_number)}`
                    )}`}
                    alt="Access Ticket QR Code"
                    width="140"
                    height="140"
                    className="border border-zinc-200 rounded p-1.5 bg-white"
                  />
                  <div className="flex gap-2.5 w-full">
                    <button
                      onClick={() => handleCopyText(`${window.location.origin}/verify/${encodeTicketSlug(selectedRequest.ticket_number)}`)}
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

              {/* Client Self-Management Panel (Cancel / Reschedule) */}
              {selectedRequest.entered_at === null && selectedRequest.status !== "denied" && selectedRequest.status !== "cancelled" && (
                <div className="pt-4 border-t border-zinc-100 space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pass Management</h4>
                  
                  {!showRescheduleForm ? (
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => setShowRescheduleForm(true)}
                        className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-xs font-bold py-2 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        Reschedule Date
                      </button>
                      <button
                        onClick={() => handleCancelRequest(selectedRequest.id)}
                        disabled={isCancelLoading}
                        className="flex-1 border border-destructive/30 hover:border-destructive text-destructive hover:bg-rose-50 text-xs font-bold py-2 rounded transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isCancelLoading ? "Cancelling..." : "Cancel Pass"}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleRescheduleRequest(selectedRequest.id, rescheduleDateInput); }} className="space-y-2.5 bg-zinc-50 border border-zinc-200 p-3 rounded text-left">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Select New Expected Arrival Date
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={rescheduleDateInput}
                          onChange={(e) => setRescheduleDateInput(e.target.value)}
                          min={new Date().toLocaleDateString("en-CA")}
                          disabled={isRescheduleLoading}
                          className="flex-1 px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isRescheduleLoading}
                          className="bg-primary-blue hover:bg-primary-dark text-white text-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isRescheduleLoading ? "Saving..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRescheduleForm(false)}
                          disabled={isRescheduleLoading}
                          className="border border-zinc-300 hover:bg-white text-zinc-600 text-xs font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
                        >
                          Back
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
