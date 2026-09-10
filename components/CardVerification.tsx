"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { 
  CreditCard, ShieldCheck, AlertTriangle, Loader2, ArrowLeft,
  ChevronRight, Package
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
  const [cardNumber] = useState(initialCardNumber);
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

  // Filter out completed passes (both check-in and check-out done)
  const activePasses = (companyRequests || []).filter(
    (req) => !(req.entered_at !== null && req.exited_at !== null)
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-zinc-100 flex flex-col items-center justify-center p-4">
      {/* Top Bar */}
      <div className="w-full max-w-lg mb-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-zinc-300 transition-colors bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Scanner</span>
        </button>
      </div>

      {/* Main Card Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded shadow-xl max-w-lg w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Company Card Verification
            </h2>
            <span className="text-[10px] text-zinc-400 font-mono">STARZS SHIPYARD</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          
          {/* STEP 1: PIN ENTRY FORM (if card not verified yet) */}
          {!cardData ? (
            <form onSubmit={handleVerifyCard} className="space-y-4 py-2">
              <div className="text-center py-2">
                <div className="w-10 h-10 rounded bg-blue-950/60 border border-blue-600/30 flex items-center justify-center text-blue-400 mx-auto mb-2">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Enter Card PIN
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Card PIN authentication is required.
                </p>
              </div>

              {error && (
                <div className="bg-rose-950/60 border-l-2 border-rose-500 text-rose-300 p-2.5 rounded text-xs font-medium flex items-start gap-2">
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
                  className="block w-full max-w-xs mx-auto px-4 py-2.5 bg-zinc-950 border border-zinc-700 rounded text-xl font-mono text-center tracking-[0.5em] text-white focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || cardPin.length !== 4}
                className="w-full bg-[#11035E] hover:bg-blue-900 text-white text-xs font-bold py-2.5 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider shadow-sm"
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
            <div className="space-y-3">
              
              {/* Verified Card Info Banner */}
              <div className="bg-zinc-950 border border-zinc-800 rounded p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase block">
                      {cardData.client_org_name}
                    </span>
                    <span className="text-[8px] font-bold text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.2 rounded">
                      Active
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                    {cardData.card_number}
                  </span>
                </div>
              </div>

              {/* Manifests List */}
              <div className="space-y-2">
                <span className="text-[11px] text-zinc-400 font-medium block">
                  Select pass to log gate entry/exit
                </span>

                {activePasses.length > 0 ? (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {activePasses.map((req) => {
                      const displayDate = req.expected_date
                        ? new Date(req.expected_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : req.created_at
                        ? new Date(req.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "";

                      return (
                        <div
                          key={req.id}
                          onClick={() => onSelectTicket(req, cardData.client_org_name)}
                          className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 p-3 rounded transition-colors cursor-pointer group flex items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="font-bold text-xs text-white uppercase group-hover:text-blue-300 transition-colors truncate block">
                              {req.visitor_name}
                            </span>

                            <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                              <span>Code: <strong className="text-white font-bold">{req.pin_code}</strong></span>
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

                          <div className="flex items-center gap-2 shrink-0">
                            {displayDate && (
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {displayDate}
                              </span>
                            )}
                            <div className="text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-800 rounded p-5 text-center space-y-1">
                    <p className="text-xs font-bold text-zinc-300 uppercase">No Active Passes Found</p>
                    <p className="text-[10px] text-zinc-500">
                      There are no active passes ready for entry/exit for this company.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
