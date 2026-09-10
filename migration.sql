-- =========================================================
-- SAFE DELTA MIGRATION SCRIPT (NON-DESTRUCTIVE)
-- =========================================================

-- 1. CREATE CLIENT DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.client_drivers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT client_driver_unique_per_client UNIQUE (client_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_drivers_client_id 
ON public.client_drivers (client_id);

-- 2. CREATE CLIENT STAFF TABLE
CREATE TABLE IF NOT EXISTS public.client_staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT client_staff_unique_per_client UNIQUE (client_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_staff_client_id 
ON public.client_staff (client_id);

-- 3. ENABLE ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.client_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated/service on client_drivers" ON public.client_drivers;
CREATE POLICY "Allow all for authenticated/service on client_drivers"
ON public.client_drivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated/service on client_staff" ON public.client_staff;
CREATE POLICY "Allow all for authenticated/service on client_staff"
ON public.client_staff FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.client_drivers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_staff TO anon, authenticated, service_role;

-- 4. SOFT DELETE COLUMNS ON access_requests
ALTER TABLE public.access_requests 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false NOT NULL;

ALTER TABLE public.access_requests 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_access_requests_is_deleted 
ON public.access_requests (is_deleted);
