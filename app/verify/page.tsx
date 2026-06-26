"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Search, Loader2, AlertTriangle, Key } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function VerifySearchPage() {
  const router = useRouter();
  
  const [pinInput, setPinInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pinInput.trim();
    if (!cleanPin) return;

    if (cleanPin.length !== 6 || !/^\d+$/.test(cleanPin)) {
      setError("PIN must be exactly 6 numeric digits.");
      return;
    }

    setIsLoading(true);

    try {
      // Query the database to retrieve the ticket number associated with this PIN
      const { data, error: queryError } = await supabase
        .from("access_requests")
        .select("ticket_number")
        .eq("pin_code", cleanPin)
        .single();

      if (queryError || !data) {
        setError("Invalid PIN. No matching entry pass found.");
        setIsLoading(false);
        return;
      }

      // If found, redirect the guard to the detailed ticket verification page
      router.push(`/verify/${data.ticket_number}`);
    } catch (err) {
      console.error("PIN lookup error:", err);
      setError("An unexpected connection error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-dark text-white flex flex-col justify-between p-4">
      
      {/* Small Header */}
      <header className="py-4 flex items-center justify-center gap-2 border-b border-primary-blue">
        <ShieldCheck className="w-6 h-6 text-white" />
        <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-center">STARZS MARINE AND ENGINEERING LTD GATE SECURITY PORTAL</span>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="bg-white text-zinc-900 border border-zinc-200 p-6 rounded w-full max-w-sm shadow-xl">
          
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-zinc-100 rounded-sm flex items-center justify-center mx-auto mb-3 text-primary-dark">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-bold uppercase text-primary-dark tracking-wider">Lookup Gate Pass</h2>
            <p className="text-zinc-500 text-[11px] mt-1 leading-relaxed">
              Enter the driver's <strong>6-digit Numeric PIN</strong> below to retrieve their official entrance credentials.
            </p>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            {error && (
              <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-3 py-2 rounded text-xs font-semibold flex items-start gap-1.5 leading-normal">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="pin" className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                6-Digit PIN Code
              </label>
              <input
                id="pin"
                type="text"
                pattern="\d*"
                maxLength={6}
                placeholder="e.g. 921083"
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow only numbers and max 6 digits
                  if (/^\d*$/.test(val) && val.length <= 6) {
                    setPinInput(val);
                  }
                }}
                disabled={isLoading}
                className="block w-full text-center tracking-widest font-mono text-2xl font-black py-2.5 bg-zinc-50 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue focus:bg-white transition-all text-primary-dark"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || pinInput.length !== 6}
              className="w-full bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-3 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying PIN...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search Pass
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-zinc-400 font-medium">
        STARZS MARINE AND ENGINEERING LTD ACCESS CONTROL &copy; 2026. All rights reserved.
      </footer>
    </div>
  );
}
