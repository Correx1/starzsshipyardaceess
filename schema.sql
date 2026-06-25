-- =========================================================================
-- Starz Access Control - B2B Client Portal Database Schema (UP-TO-DATE)
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
-- 2. TABLE: clients (B2B Client Accounts)
-- -------------------------------------------------------------------------
CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_name text NOT NULL UNIQUE,
    username text NOT NULL UNIQUE, -- Email/Username used to log in
    password text NOT NULL, -- Hashed password (SHA-256 + salt)
    salt text NOT NULL, -- Cryptographic salt
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'suspended', 'restricted')),
    notification_emails jsonb DEFAULT '[]'::jsonb NOT NULL, -- Array of up to 2 extra emails
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_clients
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 3. TABLE: access_requests (Vast B2B Access Logs with Gate Audits)
-- -------------------------------------------------------------------------
CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number text NOT NULL UNIQUE, -- E.g., STYD.MQRGNTLB-910B2539
    pin_code text NOT NULL UNIQUE, -- 6-digit backup PIN (e.g., 921083)
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    visitor_name text NOT NULL, -- Driver's name
    visitor_phone text NOT NULL,
    resources jsonb NOT NULL, -- Array of resource objects: [{"category": "staff", "quantity": 5...}]
    expected_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL CHECK (status in ('pending', 'approved', 'denied', 'cancelled')),
    denial_reason text,
    last_rescheduled_at timestamp with time zone, -- Timestamp of last rescheduling by B2B client
    entered_at timestamp with time zone, -- Gate check-in timestamp
    exited_at timestamp with time zone, -- Gate check-out timestamp
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_access_requests
BEFORE UPDATE ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -------------------------------------------------------------------------
-- 4. TABLE: admin_settings (System Configurations)
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
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Policies for clients
-- -------------------------------------------------------------------------
-- Clients cannot be read/written publicly. All client interactions 
-- (login, admin management) bypass RLS using the admin service client.

-- -------------------------------------------------------------------------
-- Policies for access_requests
-- -------------------------------------------------------------------------
-- 1. Public read of requests by ticket_number or pin_code (needed by gate verification scan)
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
