"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  LogOut, Plus, X, User, Phone, Calendar, Loader2, CheckCircle2, XCircle, 
  Search, Filter, Eye, Key, FileText, Printer, Activity, AlertTriangle, RotateCw, Mail
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ResourceItem {
  category: "staff" | "machinery" | "materials" | "other";
  quantity: number;
  type: string;
  details: string;
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

interface ClientDashboardProps {
  clientId: string;
  clientOrgName: string;
  clientUsername: string;
  clientStatus: "active" | "restricted";
  initialRequests: AccessRequest[];
  initialNotificationEmails: string[];
  allowedCategories: string[]; // E.g. ["staff", "machinery", "materials", "other"]
}

export default function ClientDashboard({
  clientId,
  clientOrgName,
  clientUsername,
  clientStatus,
  initialRequests,
  allowedCategories,
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

  // Form State - Driver Info
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [requestingStaffName, setRequestingStaffName] = useState("");
  const [requestingStaffEmail, setRequestingStaffEmail] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [clientId]);

  // Sign out B2B client
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
    
    // Reset fields (keeping selected category)
    setQuantity(1);
    setResourceType("");
    setResourceDetails("");
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
      setSubmitError("Please enter the requesting B2B staff name.");
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
      if (!response.ok) throw new Error(data.error);

      setSubmitSuccess(`Request submitted successfully! Ticket ID: ${data.ticket_number}`);
      
      // Reset forms
      setDriverName("");
      setDriverPhone("");
      setExpectedDate("");
      setAddedResources([]);
      setRequestingStaffName("");
      setRequestingStaffEmail("");
      
      // Instantly refresh the table on success
      reloadRequests();
      
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
          {submitError && (
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
            <h4 className="text-xs font-extrabold uppercase text-primary-blue tracking-wide">Requesting Staff Details</h4>
            <div>
              <input
                type="text"
                placeholder="Requesting Staff Full Name (Required)"
                value={requestingStaffName}
                onChange={(e) => setRequestingStaffName(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-200 rounded text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
            </div>
            <div>
              <input
                type="email"
                placeholder="Requesting Staff Email (Optional - For notifications)"
                value={requestingStaffEmail}
                onChange={(e) => setRequestingStaffEmail(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-200 rounded text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
              />
            </div>
          </div>

          {/* Driver/Visitor Info */}
          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <h4 className="text-xs font-extrabold uppercase text-primary-blue tracking-wide">Driver / Visitor Details</h4>
            
            <div>
              <input
                type="text"
                placeholder="Driver's Full Name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                type="tel"
                placeholder="Driver Phone Number"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5">Expected Entry Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                disabled={clientStatus === "restricted" || isSubmitting}
                className="block w-full px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue disabled:opacity-60"
                required
              />
            </div>
          </div>

          {/* Dynamic Resource Checklist Builder */}
          <div className="space-y-3 pt-3 border-t border-zinc-100">
            <h4 className="text-xs font-extrabold uppercase text-primary-blue tracking-wide">Access Resources Checklist</h4>
            
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
                    className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
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
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                    <input
                      type="text"
                      placeholder="Department / Project Details"
                      value={resourceDetails}
                      onChange={(e) => setResourceDetails(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
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
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                    <input
                      type="text"
                      placeholder="Serial Number / ID Tags (Optional)"
                      value={resourceDetails}
                      onChange={(e) => setResourceDetails(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
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
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                    />
                    <input
                      type="text"
                      placeholder="Descriptions / Dimensions / Specs"
                      value={resourceDetails}
                      onChange={(e) => setResourceDetails(e.target.value)}
                      disabled={clientStatus === "restricted" || isSubmitting}
                      className="block w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
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
      <header className="bg-primary-dark text-white px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-blue rounded-sm">
            <Key className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight uppercase">{clientOrgName}</h1>
            <p className="text-zinc-400 text-[9px] uppercase font-extrabold tracking-wider">Client Partner Portal ({clientUsername})</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {clientStatus === "restricted" && (
            <span className="bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm">
              Restricted Mode
            </span>
          )}
          <button
            onClick={handleSignOut}
            disabled={isSignOutLoading}
            className="flex items-center gap-2 text-xs md:text-sm font-bold px-3.5 md:px-4.5 py-2 md:py-2.5 bg-primary-blue hover:bg-primary-dark rounded-sm border border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSignOutLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Responsive Layout */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-5 gap-6 overflow-y-auto max-w-[1600px] w-full mx-auto">
        
        {/* DESKTOP SIDEBAR: Form & Settings (Visible only on xl screens) */}
        <div className="xl:col-span-2 hidden xl:block">
          {renderFormAndSettings()}
        </div>

        {/* RIGHT COLUMN: Requests logs history table (5 columns on mobile, 3 columns on desktop) */}
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
                    className="block w-full sm:w-[180px] md:w-[210px] pl-8 pr-3 py-1.5 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
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
                    <option value="inside">Currently Inside</option>
                    <option value="expired">Expired (Used)</option>
                    <option value="denied">Declined</option>
                  </select>
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
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-success rounded-sm font-bold">
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
                            onClick={() => handleSelectRequest(req)}
                            className="inline-flex items-center gap-1.5 px-3 md:px-4.5 py-1 md:py-1.5 border border-zinc-300 hover:border-primary-blue hover:bg-zinc-50 rounded-sm font-bold text-xs md:text-sm text-zinc-600 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-lg h-full border-l border-zinc-200 flex flex-col shadow-2xl animate-slide-in">
            
            {/* Drawer Header */}
            <div className="bg-primary-dark text-white px-6 py-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Gate Pass Details</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-mono font-black text-white tracking-wide">{selectedRequest.pin_code}</span>
                  <span className="text-zinc-400 font-mono text-xs">/ {selectedRequest.ticket_number}</span>
                </div>
              </div>
              <button
                onClick={() => handleSelectRequest(null)}
                className="text-zinc-400 hover:text-white p-1.5 border border-zinc-800 rounded hover:bg-primary-blue transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Lifecycle Status Box */}
              <div className="bg-zinc-50 border border-zinc-200 rounded p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Gate Status</span>
                <div className="text-xs font-bold uppercase">
                  {selectedRequest.status === "pending" && (
                    <span className="text-amber-500 flex items-center gap-1 font-bold text-sm">
                      <AlertTriangle className="w-4.5 h-4.5" /> Pending Approval
                    </span>
                  )}
                  {selectedRequest.status === "cancelled" && (
                    <span className="text-zinc-500 flex items-center gap-1 font-bold text-sm">
                      <XCircle className="w-4.5 h-4.5" /> Pass Cancelled
                    </span>
                  )}
                  {selectedRequest.status === "denied" && (
                    <span className="text-destructive flex items-center gap-1 font-bold text-sm">
                      <XCircle className="w-4.5 h-4.5" /> Request Declined
                    </span>
                  )}
                  {selectedRequest.status === "approved" && selectedRequest.entered_at === null && (
                    <span className="text-success flex items-center gap-1 font-bold text-sm">
                      <CheckCircle2 className="w-4.5 h-4.5" /> Approved - Ready
                    </span>
                  )}
                  {selectedRequest.entered_at !== null && selectedRequest.exited_at === null && (
                    <span className="text-primary-blue flex items-center gap-1 font-bold text-sm">
                      <Activity className="w-4.5 h-4.5" /> Visitor Inside
                    </span>
                  )}
                  {selectedRequest.entered_at !== null && selectedRequest.exited_at !== null && (
                    <span className="text-zinc-400 flex items-center gap-1 font-bold text-sm">
                      <XCircle className="w-4.5 h-4.5" /> Pass Expired (Used)
                    </span>
                  )}
                </div>
              </div>

              {/* Visitor / Driver Profile */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">Visitor Profile</h4>
                <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white">
                  <div className="px-4 py-3 flex items-start gap-3 text-sm">
                    <User className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase">Driver Name</span>
                      <span className="font-semibold text-zinc-800">{selectedRequest.visitor_name}</span>
                    </div>
                  </div>

                  {selectedRequest.requesting_staff_name && (
                    <div className="px-4 py-3 flex items-start gap-3 text-sm">
                      <User className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-bold uppercase">Requesting B2B Staff</span>
                        <span className="font-semibold text-zinc-800 text-xs">{selectedRequest.requesting_staff_name}</span>
                      </div>
                    </div>
                  )}

                  {selectedRequest.requesting_staff_email && (
                    <div className="px-4 py-3 flex items-start gap-3 text-sm">
                      <Mail className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-bold uppercase">Requesting Email</span>
                        <span className="font-semibold text-zinc-800 text-xs font-mono">{selectedRequest.requesting_staff_email}</span>
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-3 flex items-start gap-3 text-sm">
                    <Phone className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase">Phone Number</span>
                      <span className="font-semibold text-zinc-800 font-mono">{selectedRequest.visitor_phone}</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-start gap-3 text-sm">
                    <Calendar className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase">Expected Arrival</span>
                      <span className="font-semibold text-zinc-800 flex items-center gap-2">
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">Gate Auditing Logs</h4>
                <div className="border border-zinc-200 rounded divide-y divide-zinc-200 bg-white text-sm">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="font-semibold text-zinc-600">Check-In:</span>
                    <div className="text-right">
                      <span className="font-mono text-zinc-800 font-bold block">
                        {selectedRequest.entered_at ? new Date(selectedRequest.entered_at).toLocaleString() : "Not Checked In"}
                      </span>
                      {selectedRequest.entered_by && (
                        <span className="text-[10px] text-emerald-600 font-bold uppercase block mt-0.5">
                          Authorized by: {selectedRequest.entered_by}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="font-semibold text-zinc-600">Check-Out:</span>
                    <div className="text-right">
                      <span className="font-mono text-zinc-800 font-bold block">
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">Requested Resources Checklist</h4>
                <div className="bg-zinc-50 border border-zinc-200 rounded p-4 space-y-3">
                  {selectedRequest.resources.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-sm text-zinc-800 font-semibold border-b border-zinc-200/50 last:border-0 pb-2.5 last:pb-0">
                      <span className={`text-[9px] uppercase px-2 py-0.5 rounded-sm shrink-0 font-black ${
                        item.category === "staff" ? "bg-emerald-100 text-emerald-800" :
                        item.category === "machinery" ? "bg-blue-100 text-blue-800" :
                        item.category === "materials" ? "bg-amber-100 text-amber-800" :
                        "bg-zinc-100 text-zinc-800"
                      }`}>
                        {item.category}
                      </span>
                      <div>
                        <span className="text-sm">{item.quantity}x {item.type}</span>
                        {item.details && <span className="block text-xs text-zinc-500 font-semibold mt-1">{item.details}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decline reason if denied */}
              {selectedRequest.status === "denied" && selectedRequest.denial_reason && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">Reason for Denial</h4>
                  <div className="bg-rose-50 border border-rose-200 text-destructive rounded p-4 text-sm font-semibold leading-relaxed">
                    {selectedRequest.denial_reason}
                  </div>
                </div>
              )}

              {/* Scannable QR Code and Print Button (Only if Approved) */}
              {selectedRequest.status === "approved" && (
                <div className="pt-4 border-t border-zinc-100 flex flex-col items-center gap-4">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Gate Scan Pass</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                      `${window.location.origin}/verify/${selectedRequest.ticket_number}`
                    )}`}
                    alt="Access Ticket QR Code"
                    width="160"
                    height="160"
                    className="border border-zinc-200 rounded p-2 bg-white"
                  />
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => handleCopyText(`${window.location.origin}/verify/${selectedRequest.ticket_number}`)}
                      className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-sm font-bold py-2.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      {isCopied ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={`/ticket/${selectedRequest.ticket_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-primary-blue hover:bg-primary-dark text-white text-sm font-bold py-2.5 rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm text-center cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Print Pass
                    </a>
                  </div>
                </div>
              )}

              {/* Client Self-Management Panel (Cancel / Reschedule) */}
              {selectedRequest.entered_at === null && selectedRequest.status !== "denied" && selectedRequest.status !== "cancelled" && (
                <div className="pt-6 border-t border-zinc-100 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pass Management</h4>
                  
                  {!showRescheduleForm ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRescheduleForm(true)}
                        className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-xs md:text-sm font-bold py-2.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        Reschedule Date
                      </button>
                      <button
                        onClick={() => handleCancelRequest(selectedRequest.id)}
                        disabled={isCancelLoading}
                        className="flex-1 border border-destructive/30 hover:border-destructive text-destructive hover:bg-rose-50 text-xs md:text-sm font-bold py-2.5 rounded transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isCancelLoading ? "Cancelling..." : "Cancel Pass"}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleRescheduleRequest(selectedRequest.id, rescheduleDateInput); }} className="space-y-3 bg-zinc-50 border border-zinc-200 p-4 rounded text-left">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Select New Expected Arrival Date
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={rescheduleDateInput}
                          onChange={(e) => setRescheduleDateInput(e.target.value)}
                          disabled={isRescheduleLoading}
                          className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-blue"
                          required
                        />
                        <button
                          type="submit"
                          disabled={isRescheduleLoading}
                          className="bg-primary-blue hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isRescheduleLoading ? "Saving..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRescheduleForm(false)}
                          disabled={isRescheduleLoading}
                          className="border border-zinc-300 hover:bg-white text-zinc-600 text-xs font-bold px-3 py-2 rounded transition-colors cursor-pointer"
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
