/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { ShieldCheck, Key, Shield, AlertTriangle, ArrowLeft } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import Link from "next/link";
import FleetGateCard from "@/components/FleetGateCard";

interface PageProps {
  params: Promise<{ card_number: string }>;
}

export const dynamic = "force-dynamic";

export default async function PrintableCardPage({ params }: PageProps) {
  const { card_number } = await params;
  const decodedCardNumber = decodeURIComponent(card_number).trim();

  let card = null;
  let clientOrgName = "Sister Company Partner";

  try {
    const { data, error } = await supabaseAdmin
      .from("company_cards")
      .select(`
        id,
        card_number,
        client_id,
        label,
        pin,
        status,
        created_at,
        clients (
          id,
          org_name,
          username
        )
      `)
      .ilike("card_number", decodedCardNumber)
      .single();

    if (data && !error) {
      card = data;
      if (data.clients && (data.clients as any).org_name) {
        clientOrgName = (data.clients as any).org_name;
      }
    }
  } catch (err) {
    console.error("Error fetching card for printing:", err);
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl text-center max-w-sm w-full shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-rose-400 font-bold text-lg uppercase tracking-wider">Card Not Found</h2>
          <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
            The requested company gate badge does not exist or has been removed from the registry.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2.5 px-6 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://starzs-access.vercel.app";
  const qrTargetUrl = `${appUrl}/verify?card=${encodeURIComponent(card.card_number)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrTargetUrl)}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-10 px-4 print:bg-transparent print:p-6">
      
      {/* Top Controls (Hidden during print) */}
      <div className="max-w-4xl mx-auto mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-lg backdrop-blur-md print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
              Sister Company Fleet Gate Badge (CR80 PVC)
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Card Number: <span className="font-mono font-bold text-white">{card.card_number}</span> &bull; 
            Holder: <strong className="text-amber-400">{clientOrgName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <PrintButton />
        </div>
      </div>

      {/* Main Dual-Sided PVC Badge View using reusable FleetGateCard */}
      <div className="max-w-4xl mx-auto flex items-center justify-center print:block print:max-w-none">
        <FleetGateCard cardNumber={card.card_number} orgName={clientOrgName} />
      </div>

      {/* Helpful Instructions Box (Hidden on Print) */}
      <div className="max-w-xl mx-auto mt-10 bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-xs text-zinc-300 space-y-2 print:hidden shadow-lg">
        <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-blue" />
          Fleet Badge Printing & Deployment Guidelines
        </h3>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
          <li>Print on standard PVC ID card blanks (CR80 30mil) using any standard card printer (Zebra, Evolis, Fargo).</li>
          <li>Drivers can keep this card permanently in the vehicle glovebox or fleet folder.</li>
          <li>When arriving at the shipyard gate, the guard scans the QR code and requests the 4-digit PIN.</li>
          <li>All approved manifests scheduled for the company today automatically sync to this card.</li>
        </ul>
      </div>

    </div>
  );
}
