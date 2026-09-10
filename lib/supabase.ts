import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("Supabase URL is missing from environment variables.");
}

// Client for public operations (respects Row-Level Security)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for administrative backend operations (bypasses Row-Level Security)
// Guarded to prevent browser-side evaluation crashes when private keys are hidden
export const supabaseAdmin = (
  typeof window === "undefined" && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null
) as unknown as SupabaseClient;

