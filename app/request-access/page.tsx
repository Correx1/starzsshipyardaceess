import React from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import VisitorForm from "@/components/VisitorForm";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = "force-dynamic";

export default async function RequestAccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  let isValid = false;

  if (token) {
    try {
      // Query Supabase to check if the token is valid and active
      const { data, error } = await supabase
        .from("form_tokens")
        .select("token")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (data && !error) {
        isValid = true;
      }
    } catch (err) {
      console.error("Error validating form token:", err);
      isValid = false;
    }
  }

  // If the token is invalid or missing, display the professional "Expired Link" page
  if (!isValid) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-dull-white">
        <div className="bg-white border border-zinc-200 shadow-sm rounded max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className="bg-primary-dark px-6 py-5 text-white flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-destructive shrink-0" />
            <h2 className="text-lg font-bold tracking-tight">Access Link Expired</h2>
          </div>
          
          {/* Content */}
          <div className="p-6 text-center">
            <p className="text-zinc-700 text-sm leading-relaxed mb-6">
              This registration link is no longer active or is invalid. The facility administrator may have terminated this link for security reasons or generated a new one.
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded p-4 text-xs text-zinc-500 text-left">
              <span className="font-semibold text-zinc-700 block mb-1">What should I do?</span>
              Please contact the facility administrator or your host to obtain the current, active access registration link.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If the token is valid, render the single-page visitor registration form
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-dull-white">
      <VisitorForm token={token} />
    </div>
  );
}
