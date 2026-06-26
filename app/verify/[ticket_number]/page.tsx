import React from "react";
import { supabaseAdmin } from "@/lib/supabase";
import TicketVerification from "@/components/TicketVerification";
import { ShieldAlert } from "lucide-react";

interface PageProps {
  params: Promise<{ ticket_number: string }>;
}

export const dynamic = "force-dynamic";

export default async function TicketVerificationPage({ params }: PageProps) {
  const { ticket_number } = await params;
  
  let ticket = null;
  let clientOrgName = " Client Partner";
  let errorMsg = null;

  try {
    // Fetch request details joined with client information to show the organization label
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

    if (error || !data) {
      errorMsg = "Ticket not found in registration database.";
    } else {
      ticket = data;
      if (data.clients?.org_name) {
        clientOrgName = data.clients.org_name;
      }
    }
  } catch (err) {
    console.error("Error verifying ticket:", err);
    errorMsg = "An error occurred during verification.";
  }

  // Handle ticket not found or error states
  if (!ticket) {
    return (
      <div className="min-h-screen bg-dull-white flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-zinc-200 shadow-md rounded max-w-md w-full overflow-hidden p-8 text-center">
          <div className="flex justify-center mb-3 text-destructive">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-lg font-bold text-destructive uppercase tracking-wider">Invalid Ticket</h2>
          <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
            {errorMsg || "The ticket number presented is invalid or does not exist."}
          </p>
          <a
            href="/verify"
            className="mt-6 inline-block bg-primary-dark hover:bg-primary-blue text-white text-xs font-bold py-2.5 px-6 rounded transition-colors uppercase tracking-wider"
          >
            Back to Search Portal
          </a>
        </div>
      </div>
    );
  }

  // Map database request fields to TicketVerification component's types
  const mappedTicket = {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    pin_code: ticket.pin_code,
    visitor_name: ticket.visitor_name,
    visitor_email: ticket.visitor_email,
    visitor_phone: ticket.visitor_phone,
    resources: Array.isArray(ticket.resources) ? ticket.resources : [],
    expected_date: ticket.expected_date,
    status: ticket.status as "pending" | "approved" | "denied",
    denial_reason: ticket.denial_reason,
    entered_at: ticket.entered_at,
    exited_at: ticket.exited_at,
  };

  return (
    <TicketVerification
      initialTicket={mappedTicket}
      clientOrgName={clientOrgName}
    />
  );
}
