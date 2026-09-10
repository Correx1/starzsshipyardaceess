"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { 
  CreditCard, ShieldCheck, AlertTriangle, Loader2, ArrowLeft,
  User, Phone, Clock, ArrowRight, CheckCircle2, ChevronRight, Package
} from "lucide-react";

interface CardVerificationProps {
  initialCardNumber: string;
  onSelectTicket: (ticket: any, orgName: string) => void;
  onBack: () => void;
}

export default function CardVerification({
  initialCardNumber,
  onSelectTicket,
  onBack,
}: CardVerificationProps) {
  const [cardNumber, setCardNumber] = useState(initialCardNumber);
  const [cardPin, setCardPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cardData, setCardData] = useState<{
    card_number: string;
    label: string;
    client_org_name: string;
  } | null>(null);

  const [companyRequests, setCompanyRequests] = useState<any[] | null>(null);

  const handleVerifyCard = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cardNumber.trim()) {
      setError("Please provide a valid card number.");
      return;
    }
    if (!cardPin || cardPin.length !== 4) {
      setError("Please enter the 4-digit Card PIN.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/verify/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber.trim().toUpperCase(),
          pin: cardPin.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Card verification failed.");
      }

      setCardData(data.card);
      setCompanyRequests(data.requests || []);
    } catch (err: any) {
      console.error("Card verification error:", err);
      setError(err.message || "error, please contact admin");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Top Bar */}
      <div className="w-full max-w-xl mb-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Scanner</span>
        </button>
      </div>

      {/* Main Card Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-zinc-950 px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
           
            <div>
              <h2 className="text-xs font-black tracking-wider Capitalize text-white">
                Company Card Verification
              </h2>
              <span className="text-[10px] text-zinc-400 font-mono">STARZS SHIPYARD</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">
              {cardNumber}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          
          {/* STEP 1: PIN ENTRY FORM (if card not verified yet) */}
          {!cardData ? (
            <form onSubmit={handleVerifyCard} className="space-y-4">
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-full bg-blue-950/60 border border-blue-600/30 flex items-center justify-center text-blue-400 mx-auto mb-2">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Enter Card PIN
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Card PIN authentication is required.
                </p>
              </div>

              {error && (
                <div className="bg-rose-950/60 border-l-2 border-rose-500 text-rose-300 p-3 rounded text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 text-center">
                   Card PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="&bull;&bull;&bull;&bull;"
                  value={cardPin}
                  onChange={(e) => setCardPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={isLoading}
                  autoFocus
                  required
                  className="block w-full max-w-xs mx-auto px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-2xl font-mono text-center tracking-[0.5em] text-white focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || cardPin.length !== 4}
                className="w-full bg-[#11035E] hover:bg-blue-900 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating Card...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Authenticate Card
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: VERIFIED CARD COMPANY MANIFESTS LIST */
            <div className="space-y-4">
              
              {/* Verified Card Info Banner */}
              <div className="bg-zinc-950 border border-emerald-600/40 rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">
                    Verified Company
                  </span>
                  <span className="text-sm font-black text-white uppercase block">
                    {cardData.client_org_name}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {cardData.card_number} {cardData.label ? `• ${cardData.label}` : ""}
                  </span>
                </div>
                <div className="bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Active
                </div>
              </div>

              {/* Manifests List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    Approved Company Passes ({companyRequests?.length || 0})
                  </h4>
                  <span className="text-[10px] text-zinc-500">Select pass to log gate entry/exit</span>
                </div>

                {companyRequests && companyRequests.length > 0 ? (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {companyRequests.map((req) => {
                      const isCheckedIn = req.entered_at !== null;
                      const isCheckedOut = req.exited_at !== null;
                      const isCompleted = isCheckedIn && isCheckedOut;

                      return (
                        <div
                          key={req.id}
                          onClick={() => onSelectTicket(req, cardData.client_org_name)}
                          className="bg-zinc-950 border border-zinc-800 hover:border-blue-500/60 p-3.5 rounded-lg transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white uppercase group-hover:text-blue-300 transition-colors truncate">
                                {req.visitor_name}
                              </span>
                              
                              {isCompleted ? (
                                <span className="bg-zinc-800 text-zinc-400 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                  Completed
                                </span>
                              ) : isCheckedIn ? (
                                <span className="bg-amber-950 border border-amber-800 text-amber-300 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" /> Inside Facility
                                </span>
                              ) : (
                                <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                  Ready for Ingress
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                              <span>Code: <strong className="text-amber-400">{req.pin_code}</strong></span>
                              {req.visitor_phone && (
                                <span>Phone: {req.visitor_phone}</span>
                              )}
                            </div>

                            {Array.isArray(req.resources) && req.resources.length > 0 && (
                              <div className="flex items-center gap-1 text-[9px] text-zinc-500 truncate pt-0.5">
                                <Package className="w-2.5 h-2.5 shrink-0" />
                                <span>
                                  {req.resources.map((r: any) => `${r.quantity}x ${r.type}`).join(", ")}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 text-center space-y-1.5">
                    <p className="text-xs font-bold text-zinc-300 uppercase">No Approved Passes Today</p>
                    <p className="text-[11px] text-zinc-500">
                      There are no approved access manifests scheduled for {cardData.client_org_name} today.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setCardData(null);
                  setCardPin("");
                  setCompanyRequests(null);
                }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold py-2.5 rounded transition-colors cursor-pointer text-center"
              >
                Enter Another Card
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
