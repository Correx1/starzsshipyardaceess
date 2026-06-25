import React from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { Printer, ShieldCheck, User, Calendar, FileText, ArrowRight } from "lucide-react";
import PrintButton from "@/components/PrintButton";

interface PageProps {
  params: Promise<{ ticket_number: string }>;
}

export const dynamic = "force-dynamic";

export default async function PrintTicketPage({ params }: PageProps) {
  const { ticket_number } = await params;

  let ticket = null;
  let clientOrgName = "B2B Client Partner";

  try {
    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .select(`
        *,
        clients (
          org_name
        )
      `)
      .eq("ticket_number", ticket_number)
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
        <div className="bg-white border border-zinc-200 p-8 rounded text-center max-w-sm w-full shadow-sm">
          <h2 className="text-rose-600 font-bold text-lg uppercase tracking-wider">Pass Not Found</h2>
          <p className="text-zinc-500 text-xs mt-2">
            The requested gate pass does not exist or has been deleted from our system.
          </p>
        </div>
      </div>
    );
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || "https://starzs-access.vercel.app"}/verify/${ticket.ticket_number}`
  )}`;

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4 print:bg-white print:py-0">
      
      {/* Control Panel (Hidden when printing) */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center bg-white border border-zinc-200 p-4 rounded shadow-sm print:hidden">
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Gate Pass Ready</h2>
          <p className="text-[11px] text-zinc-500">Press print to generate your physical or PDF gate pass.</p>
        </div>
        <PrintButton />
      </div>

      {/* Main Print Pass Document */}
      <div className="max-w-2xl mx-auto bg-white border border-zinc-300 p-8 rounded shadow-sm print:shadow-none print:border-0 print:p-0">
        
        {/* Document Header */}
        <div className="border-b-2 border-primary-dark pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-primary-dark uppercase">STARZS Access Control</h1>
            <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block mt-1">Official Facility Entry Pass</span>
          </div>
          <div className="bg-zinc-100 border border-zinc-200 text-zinc-800 text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-success shrink-0" />
            Verified Status
          </div>
        </div>

        {/* Big Monospaced Ticket ID & PIN */}
        <div className="grid grid-cols-2 gap-4 py-6 border-b border-zinc-200">
          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded text-center">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Ticket Number</span>
            <span className="font-mono text-base font-black text-primary-dark tracking-wide">{ticket.ticket_number}</span>
          </div>
          <div className="bg-[#f0f7ff] border border-[#bfdbfe] p-4 rounded text-center">
            <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">Gate Backup PIN</span>
            <span className="font-mono text-xl font-black text-primary-blue tracking-widest">{ticket.pin_code}</span>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-zinc-200">
          
          {/* Column 1 & 2: Visitor and B2B Details */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-blue flex items-center gap-1.5">
              <User className="w-4 h-4" />
              Visitor Profile
            </h3>
            <div className="grid grid-cols-3 gap-y-3 text-xs">
              <div className="font-bold text-zinc-400 uppercase text-[9px]">Origin Partner:</div>
              <div className="col-span-2 font-bold text-zinc-800 uppercase">{clientOrgName}</div>

              {ticket.requesting_staff_name && (
                <>
                  <div className="font-bold text-zinc-400 uppercase text-[9px]">Requesting Staff:</div>
                  <div className="col-span-2 font-semibold text-zinc-800">{ticket.requesting_staff_name}</div>
                </>
              )}

              {ticket.requesting_staff_email && (
                <>
                  <div className="font-bold text-zinc-400 uppercase text-[9px]">Requesting Email:</div>
                  <div className="col-span-2 font-mono text-zinc-700 font-semibold">{ticket.requesting_staff_email}</div>
                </>
              )}

              <div className="font-bold text-zinc-400 uppercase text-[9px]">Driver Name:</div>
              <div className="col-span-2 font-semibold text-zinc-800">{ticket.visitor_name}</div>

              <div className="font-bold text-zinc-400 uppercase text-[9px]">Driver Phone:</div>
              <div className="col-span-2 font-mono text-zinc-700 font-semibold">{ticket.visitor_phone}</div>

              <div className="font-bold text-zinc-400 uppercase text-[9px]">Arrival Date:</div>
              <div className="col-span-2 font-bold text-primary-blue flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {ticket.expected_date}
              </div>
            </div>
          </div>

          {/* Column 3: Scannable QR Code */}
          <div className="flex flex-col items-center justify-center border-l border-zinc-200 pl-6 md:border-l md:pl-6 print:border-l print:pl-6">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 text-center">Gate Scan Code</span>
            <img
              src={qrCodeUrl}
              alt="Scan QR Pass"
              width="130"
              height="130"
              className="border border-zinc-200 p-1.5 bg-white rounded"
            />
          </div>

        </div>

        {/* Resource Checklist Table */}
        <div className="py-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary-blue flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Authorized Checklist of Entry Items
          </h3>
          <div className="bg-zinc-50 border border-zinc-300 rounded p-4">
            <ul className="divide-y divide-zinc-200 text-xs">
              {Array.isArray(ticket.resources) && ticket.resources.map((item: any, idx: number) => (
                <li key={idx} className="py-2.5 flex items-start gap-2 last:pb-0">
                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 border mt-0.5 ${
                    item.category === "staff" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                    item.category === "machinery" ? "bg-blue-50 border-blue-200 text-blue-800" :
                    item.category === "materials" ? "bg-amber-50 border-amber-200 text-amber-800" :
                    "bg-zinc-100 border-zinc-200 text-zinc-800"
                  }`}>
                    {item.category}
                  </span>
                  <div>
                    <span className="font-bold text-zinc-900">{item.quantity}x {item.type}</span>
                    {item.details && (
                      <span className="block text-[10px] text-zinc-500 font-semibold mt-0.5">
                        Details: {item.details}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Document Footer */}
        <div className="mt-8 pt-6 border-t border-dashed border-zinc-300 text-center text-[10px] text-zinc-400 font-medium leading-relaxed">
          <p>
            WARNING: This entry pass is valid for ONE entrance and ONE exit log only. 
            Once both logs are recorded by security gate personnel, the ticket is immediately and permanently expired. 
            Unauthorized replication or reuse of this pass is strictly prohibited.
          </p>
          <p className="mt-2 font-mono text-[9px]">
            Security Audit Code: {ticket.id.slice(0, 8).toUpperCase()} / STARZS Security Operations
          </p>
        </div>

      </div>

      {/* Self-Executing Print Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Automatically open browser print dialog on page load
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.print();
              }, 500);
            });
          `,
        }}
      />
    </div>
  );
}
