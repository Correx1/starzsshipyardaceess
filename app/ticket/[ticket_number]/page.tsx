/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { decodeTicketSlug, encodeTicketSlug } from "@/lib/slug";
import { ShieldCheck, Calendar, Package } from "lucide-react";
import PrintButton from "@/components/PrintButton";

interface PageProps {
  params: Promise<{ ticket_number: string }>;
}

export const dynamic = "force-dynamic";

export default async function PrintTicketPage({ params }: PageProps) {
  const { ticket_number } = await params;
  const decodedTicketNumber = decodeTicketSlug(ticket_number);

  let ticket = null;
  let clientOrgName = "Partner Company";

  try {
    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .select(`
        *,
        clients (
          org_name
        )
      `)
      .or(`ticket_number.ilike.${decodedTicketNumber},ticket_number.ilike.${ticket_number}`)
      .limit(1)
      .single();

    if (data && !error) {
      ticket = data;
      if (data.clients?.org_name) {
        clientOrgName = data.clients.org_name;
      }
    }
  } catch (err) {
    console.error("Error fetching ticket for printing:", err);
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="bg-white border border-zinc-200 p-8 rounded text-center max-w-xs w-full shadow-sm">
          <h2 className="text-rose-600 font-bold text-base uppercase tracking-wider">Pass Not Found</h2>
          <p className="text-zinc-500 text-xs mt-2">
            The requested gate pass does not exist or has been deleted from the system.
          </p>
        </div>
      </div>
    );
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || "https://starzs-access.vercel.app"}/verify/${encodeTicketSlug(ticket.ticket_number)}`
  )}`;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 px-4 print:bg-white print:p-0 print:m-0 text-zinc-900 font-sans flex flex-col items-center">
      <style>{`
        @page {
          size: auto;
          margin: 6mm;
        }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .receipt-container {
            margin: 0 auto !important;
            padding: 0 !important;
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
          }
          .receipt-card {
            margin: 0 auto !important;
            width: 360px !important;
            max-width: 360px !important;
            border: 1px solid #d4d4d8 !important;
            border-radius: 8px !important;
            padding: 20px !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      
      {/* Control Panel (Hidden when printing) */}
      <div className="w-full max-w-[360px] mb-4 flex justify-between items-center bg-white border border-zinc-200 p-3 rounded-lg shadow-xs no-print">
        <div>
          <h2 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Receipt Pass Ready</h2>
          <p className="text-[10px] text-zinc-500">POS thermal receipt format</p>
        </div>
        <PrintButton />
      </div>

      {/* Container to enforce centering */}
      <div className="receipt-container w-full flex justify-center">
        {/* Main POS Thermal Receipt Pass */}
        <div className="receipt-card w-full max-w-[360px] bg-white border border-zinc-300 p-6 rounded-xl shadow-md">
          
          {/* Document Header - Logo & Approved Badge Centered */}
          <div className="text-center pb-3 border-b border-dashed border-zinc-300 flex flex-col items-center justify-center gap-2">
            <img 
              src="/image.png" 
              alt="Starzs" 
              className="h-10 w-auto object-contain mx-auto" 
            />
            <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Approved Pass</span>
            </div>
          </div>

          {/* Credentials Row */}
          <div className="grid grid-cols-2 gap-2 py-3 border-b border-dashed border-zinc-300">
            <div className="bg-zinc-50 border border-zinc-200 p-2 rounded text-center">
              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block mb-0.5">Ticket ID</span>
              <span className="font-mono text-xs font-black text-zinc-900 tracking-tight block truncate">{ticket.ticket_number}</span>
            </div>
            <div className="bg-blue-50/70 border border-blue-200 p-2 rounded text-center">
              <span className="text-[8px] font-bold text-blue-700 uppercase tracking-wider block mb-0.5">Ticket Code</span>
              <span className="font-mono text-base font-black text-[#11035E] tracking-widest block">{ticket.pin_code}</span>
            </div>
          </div>

          {/* Details Manifest */}
          <div className="py-3 border-b border-dashed border-zinc-300 space-y-1.5 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-zinc-400 font-bold uppercase text-[9px] shrink-0">Partner:</span>
              <span className="font-bold text-zinc-900 text-right truncate">{clientOrgName}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-zinc-400 font-bold uppercase text-[9px] shrink-0">Driver:</span>
              <span className="font-bold text-zinc-800 text-right truncate">{ticket.visitor_name}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-zinc-400 font-bold uppercase text-[9px] shrink-0">Phone:</span>
              <span className="font-mono text-zinc-700 text-right">{ticket.visitor_phone || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-zinc-400 font-bold uppercase text-[9px] shrink-0">Date:</span>
              <span className="font-bold text-[#11035E] flex items-center gap-1 text-right">
                <Calendar className="w-3.5 h-3.5" />
                {ticket.expected_date}
              </span>
            </div>
          </div>

          {/* ITEMS Section */}
          <div className="py-3 border-b border-dashed border-zinc-300 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#11035E] font-bold text-[10px] uppercase tracking-wider">
              <Package className="w-3.5 h-3.5" />
              <span>ITEMS</span>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded p-2.5">
              {Array.isArray(ticket.resources) && ticket.resources.length > 0 ? (
                <ul className="divide-y divide-zinc-200 text-xs">
                  {ticket.resources.map((item: any, idx: number) => (
                    <li key={idx} className="py-1.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-zinc-900">{item.quantity}x {item.type}</span>
                        {item.details && (
                          <span className="block text-[10px] text-zinc-500 font-medium">
                            {item.details}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 shrink-0">
                        {item.category}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 italic">No items declared.</p>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          <div className="py-3.5 border-b border-dashed border-zinc-300 flex flex-col items-center justify-center">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block mb-1.5 text-center">Scan at Security Gate</span>
            <img
              src={qrCodeUrl}
              alt="Scan QR Pass"
              width="130"
              height="130"
              className="border border-zinc-200 p-1.5 bg-white rounded-lg shadow-xs"
            />
          </div>

          {/* Document Footer */}
          <div className="pt-3 text-center text-[9.5px] text-zinc-500 font-medium leading-relaxed">
            <p>Present this pass or 6-digit PIN at the shipyard security gate.</p>
            <p className="mt-0.5">Valid for single use .</p>
            <p className="mt-1 font-mono text-[9.5px] font-bold text-zinc-700">STARZS SHIPYARD•</p>
          </div>

        </div>
      </div>

      {/* Auto-Open Print Dialog */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.print();
              }, 400);
            });
          `,
        }}
      />
    </div>
  );
}
