"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
  ShieldCheck, Calendar, User, Phone, Mail, Loader2, ArrowLeft, Clock,
  Truck, Shield, ArrowRight, Printer, Building2
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
  onBack?: () => void;
}

export default function TicketVerification({ initialTicket, clientOrgName, onBack }: TicketVerificationProps) {
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketData>(initialTicket);
  const [isLoading, setIsLoading] = useState(false);
  const [guardCode, setGuardCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mask address bar URL to clean /verify
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/verify") {
      window.history.replaceState(null, "", "/verify");
    }
  }, []);

  // Determine ticket lifecycle status
  const isPending = ticket.status === "pending";
  const isDenied = ticket.status === "denied";
  const isCancelled = ticket.status === "cancelled";
  const isApproved = ticket.status === "approved" && !isCancelled;
  const isCheckedIn = ticket.entered_at !== null;
  const isCheckedOut = ticket.exited_at !== null;
  const isExpired = isCheckedIn && isCheckedOut;

  // Play audio chime
  const playFeedbackSound = (type: "success" | "error") => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === "success") {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
      }

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio context may be restricted
    }
  };

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
      const response = await fetch("/api/verify/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: ticket.id, guard_code: guardCode.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTicket(data.request);
      setSuccessMsg("Check-In Authorized: Entry timestamp and security officer code logged.");
      playFeedbackSound("success");
      setGuardCode("");
    } catch (err: any) {
      console.error("Check-in error:", err);
      setError(err.message || "Failed to log check-in.");
      playFeedbackSound("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Check-Out Action
  const handleCheckOut = async () => {
    if (!guardCode.trim()) {
      setError("Please enter your Security Guard Code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/verify/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: ticket.id, guard_code: guardCode.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setTicket(data.request);
      setSuccessMsg("Check-Out Completed: Exit timestamp recorded. Pass lifecycle finished.");
      playFeedbackSound("success");
      setGuardCode("");
    } catch (err: any) {
      console.error("Check-out error:", err);
      setError(err.message || "Failed to log check-out.");
      playFeedbackSound("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 print:bg-white print:p-0">
      
      {/* Top Navigation Bar */}
      <div className="w-full max-w-xl mb-3 flex items-center justify-between print:hidden">
        <button
          onClick={() => {
            if (onBack) {
              onBack();
            } else {
              router.push("/verify");
            }
          }}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Security Terminal</span>
        </button>
      </div>

      {/* Main Inspection Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded shadow-2xl max-w-xl w-full overflow-hidden print:border print:border-black print:shadow-none">
        
        {/* Terminal Header */}
        <div className="bg-zinc-950 px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#11035E] border border-blue-600/40 flex items-center justify-center text-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs font-black tracking-wider uppercase text-white">
                Gate Inspection & Audit
              </h1>
              <span className="text-[10px] text-zinc-400 font-mono">STARZS SHIPYARD PORT HARCOURT</span>
            </div>
          </div>
        </div>

        {/* Dynamic Lifecycle Status Banner */}
        {isExpired ? (
          <div className="bg-zinc-950 border-b border-rose-900/60 p-4 text-center">
            <div className="flex justify-center mb-1 text-rose-500">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-black text-rose-400 uppercase tracking-wider">
              TICKET EXPIRED & ALREADY USED
            </h2>
          </div>
        ) : isCheckedIn ? (
          <div className="bg-zinc-950 border-b border-amber-900/60 p-4 text-center">
            <div className="flex justify-center mb-1 text-amber-400">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-sm font-black text-amber-300 uppercase tracking-wider">
              VISITOR CURRENTLY INSIDE SHIPYARD
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              In-facility duration active. Security must log checkout upon vehicle departure.
            </p>
          </div>
        ) : isApproved ? (
          <div className="bg-zinc-950 border-b border-emerald-900/60 p-4 text-center">
            <div className="flex justify-center mb-1 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-black text-emerald-300 uppercase tracking-wider">
              VERIFIED PASS &bull; APPROVED FOR ACCESS IN
            </h2>
          </div>
        ) : isCancelled ? (
          <div className="bg-zinc-950 border-b border-rose-900/60 p-4 text-center">
            <div className="flex justify-center mb-1 text-rose-500">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-black text-rose-400 uppercase tracking-wider">
              ACCESS CANCELLED / REVOKED
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              This pass was cancelled by the requesting partner client. Entry prohibited.
            </p>
          </div>
        ) : isDenied ? (
          <div className="bg-zinc-950 border-b border-rose-900/60 p-4 text-center">
            <div className="flex justify-center mb-1 text-rose-500">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-sm font-black text-rose-400 uppercase tracking-wider">
              ENTRY REQUEST DECLINED
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              This entry request was declined by facility security administration.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-950 border-b border-amber-900/60 p-4 text-center">
            <div className="flex justify-center mb-1 text-amber-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-sm font-black text-amber-300 uppercase tracking-wider">
              PENDING ADMIN APPROVAL
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              Awaiting administration approval before gate entry can be granted.
            </p>
          </div>
        )}

        {/* Form Message Feedback */}
        {successMsg && (
          <div className="px-5 pt-4">
            <div className="bg-emerald-950/60 border-l-2 border-emerald-500 text-emerald-300 p-3 rounded text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* Ticket Details Body */}
        <div className="p-5 space-y-4">
          
          {/* Monospaced Pass Credentials */}
          <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-3.5 rounded border border-zinc-800">
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-0.5">
                Ticket ID
              </span>
              <span className="font-mono text-xs font-black text-white tracking-wider truncate block">
                {ticket.ticket_number}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-0.5">
                Ticket Code
              </span>
              <span className="font-mono text-xs font-black text-amber-400 tracking-widest block">
                {ticket.pin_code}
              </span>
            </div>
          </div>

          {/* Visitor / Driver Manifest */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              Visitor Profile & Entity
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded">
                <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-0.5">Partner Company</span>
                <span className="font-bold text-white uppercase truncate block">{clientOrgName}</span>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded">
                <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-0.5">Driver / Visitor Name</span>
                <span className="font-bold text-zinc-200 truncate block">{ticket.visitor_name}</span>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded">
                <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-0.5">Driver Phone</span>
                <span className="font-mono font-semibold text-zinc-300">{ticket.visitor_phone || "Not Specified"}</span>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded">
                <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-0.5">Scheduled Date</span>
                <span className="font-bold text-amber-300">{ticket.expected_date}</span>
              </div>

              {ticket.requesting_staff_name && (
                <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded sm:col-span-2">
                  <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-0.5">Requesting Staff / Officer</span>
                  <span className="font-medium text-zinc-300">{ticket.requesting_staff_name}</span>
                  {ticket.requesting_staff_email && (
                    <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">{ticket.requesting_staff_email}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cargo Checklist */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-400" />
              ITEMS
            </h3>

            <div className="bg-zinc-950 border border-zinc-800 rounded p-3">
              {ticket.resources && ticket.resources.length > 0 ? (
                <ul className="divide-y divide-zinc-800 text-xs">
                  {ticket.resources.map((item, idx) => (
                    <li key={idx} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                            item.category === "staff" ? "bg-emerald-950 border-emerald-800 text-emerald-300" :
                            item.category === "machinery" ? "bg-blue-950 border-blue-800 text-blue-300" :
                            item.category === "materials" ? "bg-amber-950 border-amber-800 text-amber-300" :
                            "bg-zinc-800 border-zinc-700 text-zinc-300"
                          }`}>
                            {item.category}
                          </span>
                          <span className="font-bold text-white">{item.quantity}x {item.type}</span>
                        </div>
                        {item.details && (
                          <span className="block text-[10px] text-zinc-400 mt-0.5 pl-1">
                            &bull; {item.details}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500 italic">No items declared.</p>
              )}
            </div>
          </div>

          {/* Gate Logs Timestamps */}
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Gate Check Logs
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded">
                <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-1">Check-In Timestamp</span>
                <span className="font-mono text-xs font-bold text-zinc-200 block">
                  {ticket.entered_at ? new Date(ticket.entered_at).toLocaleString() : "Pending Check-In"}
                </span>
                {ticket.entered_by && (
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">Authorized by: {ticket.entered_by}</span>
                )}
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded">
                <span className="text-[9px] text-zinc-400 font-bold uppercase block mb-1">Check-Out Timestamp</span>
                <span className="font-mono text-xs font-bold text-zinc-200 block">
                  {ticket.exited_at ? new Date(ticket.exited_at).toLocaleString() : "Pending Check-Out"}
                </span>
                {ticket.exited_by && (
                  <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">Authorized by: {ticket.exited_by}</span>
                )}
              </div>
            </div>
          </div>

          {/* Denial Reason if applicable */}
          {isDenied && ticket.denial_reason && (
            <div className="bg-rose-950/60 border-l-2 border-rose-500 text-rose-300 rounded p-3 text-xs space-y-0.5">
              <span className="font-bold block uppercase text-[10px] tracking-wider text-rose-400">Denial Reason:</span>
              <p className="text-zinc-200">{ticket.denial_reason}</p>
            </div>
          )}

          {/* Guard Action Panel */}
          {isApproved && !isExpired && !isCancelled && (
            <div className="pt-3 border-t border-zinc-800 space-y-3 print:hidden">
              {error && (
                <div className="bg-rose-950/60 border-l-2 border-rose-500 text-rose-300 p-3 rounded text-xs font-medium flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Guard Authorization Code */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                  Security Officer Guard Code (Required)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="Enter Guard Code"
                  value={guardCode}
                  onChange={(e) => setGuardCode(e.target.value)}
                  disabled={isLoading}
                  className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded text-xs placeholder:text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono tracking-widest text-center font-bold"
                />
              </div>

              {!isCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={isLoading || !guardCode.trim()}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs uppercase tracking-wider"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging Check-In...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Confirm Check-In
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCheckOut}
                  disabled={isLoading || !guardCode.trim()}
                  className="w-full bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold py-2.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs uppercase tracking-wider"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging Check-Out...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Confirm Check-Out
                    </>
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
