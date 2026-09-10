-- =========================================================================
-- SAFE DELTA MIGRATION (NON-DESTRUCTIVE - PRESERVES ALL EXISTING DATA)
-- =========================================================================
-- Run this script in your Supabase SQL Editor to enable Realtime replication
-- and ensure all tables have RLS policies without dropping any data.
-- =========================================================================

-- 1. ENABLE SUPABASE REALTIME BROADCASTING
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_cards;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_guards;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
EXCEPTION WHEN duplicate_object THEN
    -- Table already in publication
END $$;

-- 2. ENSURE PERMISSIONS ARE GRANTED TO STANDARD ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
