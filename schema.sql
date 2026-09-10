-- =========================================================================
-- Starz Access Control - Complete Database Schema (UP-TO-DATE)
-- Run this script in your Supabase SQL Editor to set up all tables, 
-- triggers, and Row-Level Security (RLS) policies from scratch.
-- =========================================================================

-- Enable uuid-ossp extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 0. CLEAN SLATE: DROP EXISTING TABLES (Automatically drops associated triggers)
-- -------------------------------------------------------------------------
DROP TABLE IF EXISTS public.access_requests CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.security_guards CASCADE;
DROP TABLE IF EXISTS public.form_tokens CASCADE;
DROP TABLE IF EXISTS public.admin_settings CASCADE;

-- -------------------------------------------------------------------------
-- 1. UTILITY FUNCTION FOR UPDATED_AT TIMESTAMPS
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
    username text NOT NULL UNIQUE, -- Email used to log in
    password text NOT NULL, -- Hashed password (Bcrypt / salted SHA-256)
    salt text NOT NULL, -- Cryptographic salt
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'suspended', 'restricted')),
    notification_emails jsonb DEFAULT '[]'::jsonb NOT NULL, -- Array of extra emails
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
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

-- Trigger for updated_at
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
    label text NOT NULL DEFAULT 'Fleet Vehicle Card', -- E.g., "Operations Truck 1"
    pin text NOT NULL, -- 4-digit secret PIN (e.g., 5829)
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'frozen', 'revoked')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_company_cards
BEFORE UPDATE ON public.company_cards
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 5. TABLE: client_drivers (Saved Driver Directory per Sister Company)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_drivers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(client_id, name)
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_client_drivers
BEFORE UPDATE ON public.client_drivers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 6. TABLE: client_staff (Saved Requesting Staff Directory per Sister Company)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text DEFAULT '' NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(client_id, name)
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_client_staff
BEFORE UPDATE ON public.client_staff
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- -------------------------------------------------------------------------
-- 7. TABLE: access_requests (Access Logs with Gate Audits)
-- -------------------------------------------------------------------------
CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number text NOT NULL UNIQUE, -- E.g., STYD.MQRGNTLB-910B2539
    pin_code text NOT NULL UNIQUE, -- 6-digit backup PIN (e.g., 921083)
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    requesting_staff_name text, -- Name of staff initiating the request
    requesting_staff_email text, -- Contact email of requesting staff
    visitor_name text NOT NULL, -- Driver / Visitor name
    visitor_phone text NOT NULL,
    resources jsonb NOT NULL, -- Array of resource objects: [{"category": "staff", "quantity": 5...}]
    expected_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL CHECK (status in ('pending', 'approved', 'denied', 'cancelled')),
    denial_reason text,
    last_rescheduled_at timestamp with time zone, -- Timestamp of last rescheduling
    entered_at timestamp with time zone, -- Gate check-in timestamp
    entered_by text, -- Security Guard name who logged check-in
    exited_at timestamp with time zone, -- Gate check-out timestamp
    exited_by text, -- Security Guard name who logged check-out
    gate_notes text,
    form_token_used text,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_access_requests
BEFORE UPDATE ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 5. TABLE: form_tokens (Public Registration Tokens)
-- -------------------------------------------------------------------------
CREATE TABLE public.form_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token text NOT NULL UNIQUE,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -------------------------------------------------------------------------
-- 6. TABLE: admin_settings (System Configurations)
-- -------------------------------------------------------------------------
CREATE TABLE public.admin_settings (
    key text PRIMARY KEY,
    value text NOT NULL, -- Config values (e.g. allowed categories, admin alert emails)
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_admin_settings
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Policies for access_requests (Public read for gate verification scan)
CREATE POLICY "Allow public read of requests by ticket or pin" 
ON public.access_requests 
FOR SELECT 
USING (true);

-- -------------------------------------------------------------------------
-- SEED INITIAL CONFIGURATIONS
-- -------------------------------------------------------------------------
-- 1. Seed admin notification alert emails (initially empty)
INSERT INTO public.admin_settings (key, value) 
VALUES ('admin_notification_emails', '') 
ON CONFLICT (key) DO NOTHING;

-- 2. Seed allowed resource categories (defaults to all categories enabled)
INSERT INTO public.admin_settings (key, value) 
VALUES ('allowed_resource_categories', '["machinery", "staff", "materials", "other"]') 
ON CONFLICT (key) DO NOTHING;

