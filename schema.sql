-- =========================================================================
-- STARZ SHIPYARD ACCESS CONTROL - COMPLETE MASTER DATABASE SCHEMA
-- =========================================================================
-- Run this entire script in your Supabase SQL Editor.
-- It wipes existing tables and sets up all tables, relations, triggers,
-- indexes, RLS policies, and seed configurations from scratch in 1 click.
-- =========================================================================

-- Enable required Postgres extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 0. CLEAN SLATE: DROP ALL EXISTING TABLES & TRIGGERS (CASCADE)
-- -------------------------------------------------------------------------
DROP TABLE IF EXISTS public.access_requests CASCADE;
DROP TABLE IF EXISTS public.company_cards CASCADE;
DROP TABLE IF EXISTS public.client_drivers CASCADE;
DROP TABLE IF EXISTS public.client_staff CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.security_guards CASCADE;
DROP TABLE IF EXISTS public.form_tokens CASCADE;
DROP TABLE IF EXISTS public.admin_settings CASCADE;

-- -------------------------------------------------------------------------
-- 1. UTILITY TRIGGER FUNCTION (AUTOMATIC updated_at)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 2. TABLE: clients (Partner & Sister Company Accounts)
-- -------------------------------------------------------------------------
CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_name text NOT NULL UNIQUE,
    username text NOT NULL UNIQUE, -- Email/Username used to log in
    password text NOT NULL,        -- Hashed password (Bcrypt / salted SHA-256)
    salt text NOT NULL,            -- Cryptographic salt
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'suspended', 'restricted')),
    notification_emails jsonb DEFAULT '[]'::jsonb NOT NULL, -- Array of extra alert emails
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_clients_username ON public.clients (username);
CREATE INDEX idx_clients_org_name ON public.clients (org_name);

CREATE TRIGGER set_updated_at_clients
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 3. TABLE: security_guards (Gate Security Officers)
-- -------------------------------------------------------------------------
CREATE TABLE public.security_guards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text NOT NULL,
    code text NOT NULL UNIQUE, -- 6-character authorization code (e.g. 5829TY)
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'inactive')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_security_guards_code ON public.security_guards (code);

CREATE TRIGGER set_updated_at_security_guards
BEFORE UPDATE ON public.security_guards
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 4. TABLE: company_cards (Reusable Access Cards for Sister Companies)
-- -------------------------------------------------------------------------
CREATE TABLE public.company_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    card_number text NOT NULL UNIQUE, -- E.g. CRD-STZ-SICL-01
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    label text NOT NULL DEFAULT 'Fleet Vehicle Card', -- E.g. "Operations Truck 1"
    pin text NOT NULL, -- 4-digit secret PIN (e.g. 5829)
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'frozen', 'revoked')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_company_cards_card_number ON public.company_cards (card_number);
CREATE INDEX idx_company_cards_client_id ON public.company_cards (client_id);

CREATE TRIGGER set_updated_at_company_cards
BEFORE UPDATE ON public.company_cards
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 5. TABLE: client_drivers (Saved Driver Directory per Sister Company)
-- -------------------------------------------------------------------------
CREATE TABLE public.client_drivers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT client_driver_unique_per_client UNIQUE (client_id, name)
);

CREATE INDEX idx_client_drivers_client_id ON public.client_drivers (client_id);

CREATE TRIGGER set_updated_at_client_drivers
BEFORE UPDATE ON public.client_drivers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 6. TABLE: client_staff (Saved Requesting Staff Directory per Sister Company)
-- -------------------------------------------------------------------------
CREATE TABLE public.client_staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text DEFAULT '' NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT client_staff_unique_per_client UNIQUE (client_id, name)
);

CREATE INDEX idx_client_staff_client_id ON public.client_staff (client_id);

CREATE TRIGGER set_updated_at_client_staff
BEFORE UPDATE ON public.client_staff
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 7. TABLE: access_requests (Access Logs with Gate Audits & Soft Delete)
-- -------------------------------------------------------------------------
CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number text NOT NULL UNIQUE,          -- E.g. STYD.MQRGNTLB-910B2539
    pin_code text NOT NULL UNIQUE,               -- 6-digit backup PIN (e.g. 921083)
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    requesting_staff_name text,                  -- Name of staff initiating request
    requesting_staff_email text,                 -- Contact email of requesting staff
    visitor_name text NOT NULL,                  -- Driver / Visitor name
    visitor_phone text NOT NULL,
    resources jsonb NOT NULL DEFAULT '[]'::jsonb,-- Array of resource objects: [{"category": "staff", "quantity": 5...}]
    expected_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL CHECK (status in ('pending', 'approved', 'denied', 'cancelled')),
    denial_reason text,
    last_rescheduled_at timestamp with time zone,
    entered_at timestamp with time zone,         -- Gate check-in timestamp
    entered_by text,                             -- Security Guard name who logged check-in
    exited_at timestamp with time zone,          -- Gate check-out timestamp
    exited_by text,                              -- Security Guard name who logged check-out
    gate_notes text,
    form_token_used text,
    is_deleted boolean DEFAULT false NOT NULL,   -- Soft delete flag
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_access_requests_ticket_number ON public.access_requests (ticket_number);
CREATE INDEX idx_access_requests_pin_code ON public.access_requests (pin_code);
CREATE INDEX idx_access_requests_client_id ON public.access_requests (client_id);
CREATE INDEX idx_access_requests_status ON public.access_requests (status);
CREATE INDEX idx_access_requests_is_deleted ON public.access_requests (is_deleted);
CREATE INDEX idx_access_requests_expected_date ON public.access_requests (expected_date);

CREATE TRIGGER set_updated_at_access_requests
BEFORE UPDATE ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 8. TABLE: form_tokens (Public Dynamic Registration Tokens)
-- -------------------------------------------------------------------------
CREATE TABLE public.form_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token text NOT NULL UNIQUE,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_form_tokens_token ON public.form_tokens (token);

-- -------------------------------------------------------------------------
-- 9. TABLE: admin_settings (System Configurations)
-- -------------------------------------------------------------------------
CREATE TABLE public.admin_settings (
    key text PRIMARY KEY,
    value text NOT NULL, -- Config values (e.g. allowed categories, admin alert emails)
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TRIGGER set_updated_at_admin_settings
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- 10. ROW-LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- =========================================================================
-- Enable RLS across all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Grant permissions to standard roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Permissive policies for complete Web & Native Mobile functionality
CREATE POLICY "Allow all operations for clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for security_guards" ON public.security_guards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for company_cards" ON public.company_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for client_drivers" ON public.client_drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for client_staff" ON public.client_staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for access_requests" ON public.access_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for form_tokens" ON public.form_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for admin_settings" ON public.admin_settings FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- 11. SEED INITIAL DEFAULT CONFIGURATIONS
-- =========================================================================
-- 1. Seed admin notification alert emails (empty initially)
INSERT INTO public.admin_settings (key, value) 
VALUES ('admin_notification_emails', '') 
ON CONFLICT (key) DO NOTHING;

-- 2. Seed allowed resource categories (defaults to all categories enabled)
INSERT INTO public.admin_settings (key, value) 
VALUES ('allowed_resource_categories', '["machinery", "staff", "materials", "other"]') 
ON CONFLICT (key) DO NOTHING;

-- 3. Seed an initial active public access form token
INSERT INTO public.form_tokens (token, is_active)
VALUES ('STARZ-ACCESS-GENERAL', true)
ON CONFLICT (token) DO NOTHING;

-- =========================================================================
-- 12. ENABLE SUPABASE REALTIME REPLICATION (INSTANT UI UPDATES)
-- =========================================================================
-- Enable real-time broadcasting on critical tables
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
EXCEPTION WHEN duplicate_object THEN
    -- already added
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_cards;
EXCEPTION WHEN duplicate_object THEN
    -- already added
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_guards;
EXCEPTION WHEN duplicate_object THEN
    -- already added
END $$;

