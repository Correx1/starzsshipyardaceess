"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, XCircle, AlertTriangle, ShieldAlert, ArrowRight, 
  ShieldCheck, Calendar, User, Phone, Mail, Loader2, ArrowLeft, Clock
} from "lucide-react";

interface ResourceItem {
  category: "staff" | "machinery" | "materials" | "other";
  quantity: number;
  type: string;
  details: string;
}

interface TicketData {
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
  entered_by?: string | null;
  exited_by?: string | null;
  requesting_staff_name?: string;
  requesting_staff_email?: string;
}

interface TicketVerificationProps {
  initialTicket: TicketData;
  clientOrgName: string;
}

export default function TicketVerification({ initialTicket, clientOrgName }: TicketVerificationProps) {
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketData>(initialTicket);
  const [isLoading, setIsLoading] = useState(false);
  const [guardCode, setGuardCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Determine ticket lifecycle status
  const isPending = ticket.status === "pending";
  const isDenied = ticket.status === "denied";
  const isCancelled = ticket.status === "cancelled";
  const isApproved = ticket.status === "approved" && !isCancelled;
  const isCheckedIn = ticket.entered_at !== null;
  const isCheckedOut = ticket.exited_at !== null;
  const isExpired = isCheckedIn && isCheckedOut;

  // Handle Check-In Action
  const handleCheckIn = async () => {
    if (!guardCode.trim()) {
      setError("Please enter your Security Guard Authorization Code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/admin/requests/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: ticket.id, guard_code: guardCode.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTicket(data.request);
      setSuccessMsg("Check-In logged successfully. Access granted.");
      setGuardCode(""); // Clear code input
    } catch (err: any) {
      console.error("Check-in error:", err);
      setError(err.message || "Failed to log check-in.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Check-Out Action
  const handleCheckOut = async () => {
    if (!guardCode.trim()) {
      setError("Please enter your Security Guard Authorization Code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/admin/requests/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: ticket.id, guard_code: guardCode.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTicket(data.request);
      setSuccessMsg("Check-Out logged successfully. Ticket is now expired.");
      setGuardCode(""); // Clear code input
    } catch (err: any) {
      console.error("Check-out error:", err);
      setError(err.message || "Failed to log check-out.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dull-white flex flex-col items-center justify-center p-4 text-zinc-900">
      
      {/* Back Button (Hidden on Print) */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.push("/verify")}
          className="flex items-center gap-1 text-xs font-bold text-primary-blue hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Search Portal
        </button>
      </div>

      <div className="bg-white border border-zinc-200 shadow-md rounded max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-primary-dark px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-white" />
            <h1 className="text-xs font-bold tracking-tight uppercase">Security Audit Gate</h1>
          </div>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Live Scanner</span>
        </div>

        {/* Dynamic Lifecycle Status Banner */}
        {isExpired ? (
          <div className="bg-rose-100 border-b border-rose-300 p-6 text-center">
            <div className="flex justify-center mb-3 text-rose-600">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <h2 className="text-base font-black text-rose-700 uppercase tracking-wider">TICKET EXPIRED & ALREADY USED</h2>
            <p className="text-zinc-600 text-[11px] font-semibold mt-1.5 max-w-xs mx-auto leading-relaxed">
              This ticket has already been used for both check-in and check-out. Access is strictly denied.
            </p>
          </div>
        ) : isCheckedIn ? (
          <div className="bg-blue-50 border-b border-blue-200 p-6 text-center">
            <div className="flex justify-center mb-3 text-primary-blue">
              <Clock className="w-12 h-12" />
            </div>
            <h2 className="text-base font-black text-primary-blue uppercase tracking-wider">VISITOR CURRENTLY INSIDE</h2>
            <p className="text-zinc-600 text-[11px] font-semibold mt-1 leading-relaxed">
              This visitor was checked in. Log exit to complete the access lifecycle.
            </p>
          </div>
        ) : isApproved ? (
          <div className="bg-emerald-50 border-b border-emerald-200 p-6 text-center">
            <div className="flex justify-center mb-3 text-success">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-base font-black text-success uppercase tracking-wider">VERIFIED ACCESS APPROVED</h2>
            <p className="text-zinc-600 text-[11px] font-semibold mt-1 leading-relaxed">
              This ticket is active and authorized for entry. Log check-in now.
            </p>
          </div>
        ) : isCancelled ? (
          <div className="bg-rose-100 border-b border-rose-300 p-6 text-center">
            <div className="flex justify-center mb-3 text-rose-600">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <h2 className="text-base font-black text-rose-700 uppercase tracking-wider">ACCESS CANCELLED / REVOKED</h2>
            <p className="text-zinc-600 text-[11px] font-semibold mt-1 leading-relaxed">
              This access request has been cancelled by the  client workspace. Access is strictly denied.
            </p>
          </div>
        ) : isDenied ? (
          <div className="bg-rose-50 border-b border-rose-200 p-6 text-center">
            <div className="flex justify-center mb-3 text-destructive">
              <XCircle className="w-12 h-12" />
            </div>
            <h2 className="text-base font-black text-destructive uppercase tracking-wider">ACCESS DECLINED</h2>
            <p className="text-zinc-600 text-[11px] font-semibold mt-1 leading-relaxed">
              This entry request has been officially declined. Do not grant access.
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border-b border-amber-200 p-6 text-center">
            <div className="flex justify-center mb-3 text-amber-500">
              <AlertTriangle className="w-12 h-12 animate-pulse" />
            </div>
            <h2 className="text-base font-black text-amber-500 uppercase tracking-wider">PENDING APPROVAL</h2>
            <p className="text-zinc-600 text-[11px] font-semibold mt-1 leading-relaxed">
              This request is waiting for administrator decision. Access cannot be granted yet.
            </p>
          </div>
        )}

        {/* Form Message Feedback */}
        {successMsg && (
          <div className="px-6 pt-4">
            <div className="bg-emerald-50 border-l-2 border-success text-success px-3 py-2.5 rounded text-xs font-bold leading-normal">
              {successMsg}
            </div>
          </div>
        )}

        {/* Ticket Details */}
        <div className="p-6 space-y-5">
          {/* Monospaced Ticket ID & PIN */}
          <div className="grid grid-cols-2 gap-3 pb-4 border-b border-zinc-100">
            <div>
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-0.5">Ticket Number</span>
              <span className="font-mono text-xs font-bold text-primary-dark tracking-tighter truncate block">{ticket.ticket_number}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-0.5">Backup PIN</span>
              <span className="font-mono text-sm font-black text-primary-blue tracking-widest block">{ticket.pin_code}</span>
            </div>
          </div>

          {/* Visitor profile */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-extrabold uppercase text-primary-blue tracking-wider">Visitor Profile</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase block">Partner Company:</span>
                  <span className="font-bold text-zinc-800 uppercase">{clientOrgName}</span>
                </div>
              </div>

              {ticket.requesting_staff_name && (
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[8px] text-zinc-400 font-bold uppercase block">Requesting  Staff:</span>
                    <span className="font-semibold text-zinc-800">{ticket.requesting_staff_name}</span>
                  </div>
                </div>
              )}

              {ticket.requesting_staff_email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[8px] text-zinc-400 font-bold uppercase block">Requesting Email:</span>
                    <span className="font-semibold text-zinc-800 font-mono">{ticket.requesting_staff_email}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase block">Driver's Name:</span>
                  <span className="font-semibold text-zinc-800">{ticket.visitor_name}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase block">Driver Phone:</span>
                  <span className="font-semibold text-zinc-700 font-mono">{ticket.visitor_phone}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase block">Scheduled Arrival Date:</span>
                  <span className="font-bold text-primary-dark">{ticket.expected_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auditing Timestamps */}
          <div className="pt-4 border-t border-zinc-100 space-y-2">
            <h3 className="text-[10px] font-extrabold uppercase text-primary-blue tracking-wider">Gate Check Logs</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-50 border border-zinc-200 p-2.5 rounded">
                <span className="text-[8px] text-zinc-400 font-bold uppercase block">Check-In Time</span>
                <span className="font-mono text-[10px] font-semibold text-zinc-800 block">
                  {ticket.entered_at ? new Date(ticket.entered_at).toLocaleString() : "Pending"}
                </span>
              </div>
              <div className="bg-zinc-50 border border-zinc-200 p-2.5 rounded">
                <span className="text-[8px] text-zinc-400 font-bold uppercase block">Check-Out Time</span>
                <span className="font-mono text-[10px] font-semibold text-zinc-800 block">
                  {ticket.exited_at ? new Date(ticket.exited_at).toLocaleString() : "Pending"}
                </span>
              </div>
            </div>
          </div>



          {/* Resource Checklist */}
          <div className="pt-4 border-t border-zinc-100">
            <span className="text-[10px] font-extrabold uppercase text-primary-blue tracking-wider block mb-2">
              Authorized Checklist of Entry Items
            </span>
            <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
              <ul className="divide-y divide-zinc-200/60 text-xs">
                {ticket.resources.map((item, idx) => (
                  <li key={idx} className="py-2 flex items-start gap-2 last:pb-0">
                    <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded shrink-0 border mt-0.5 ${
                      item.category === "staff" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                      item.category === "machinery" ? "bg-blue-50 border-blue-200 text-blue-800" :
                      item.category === "materials" ? "bg-amber-50 border-amber-200 text-amber-800" :
                      "bg-zinc-100 border-zinc-200 text-zinc-800"
                    }`}>
                      {item.category}
                    </span>
                    <div>
                      <span className="font-semibold text-zinc-800">{item.quantity}x {item.type}</span>
                      {item.details && (
                        <span className="block text-[10px] text-zinc-500 font-medium">
                          • {item.details}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Denial Reason if applicable */}
          {isDenied && ticket.denial_reason && (
            <div className="bg-rose-50 border border-rose-200 text-destructive rounded p-3.5 text-xs">
              <span className="font-bold block mb-1">Denial Reason:</span>
              {ticket.denial_reason}
            </div>
          )}

          {/* Gatekeeper Actions (Only if Approved and not fully Expired) */}
          {isApproved && !isExpired && !isCancelled && (
            <div className="pt-4 border-t border-zinc-100 space-y-3.5">
              {error && (
                <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-3 py-2.5 rounded text-xs font-bold leading-normal">
                  {error}
                </div>
              )}
              {/* Security Guard Code Input */}
              <div className="space-y-1 text-left">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Security Guard Authorization Code (Required)
                </label>
                <input
                  type="text"
                  placeholder="Enter your assigned unique code"
                  value={guardCode}
                  onChange={(e) => setGuardCode(e.target.value)}
                  disabled={isLoading}
                  className="block w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded text-xs md:text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 focus:border-primary-blue"
                />
              </div>

              {!isCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={isLoading || !guardCode.trim()}
                  className="w-full bg-success hover:bg-emerald-600 text-white text-xs font-bold py-3.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging Check-In...
                    </>
                  ) : (
                    "Confirm Check-In (Grant Access)"
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCheckOut}
                  disabled={isLoading || !guardCode.trim()}
                  className="w-full bg-destructive hover:bg-rose-600 text-white text-xs font-bold py-3.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging Check-Out...
                    </>
                  ) : (
                    "Confirm Check-Out (Log Exit)"
                  )}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
