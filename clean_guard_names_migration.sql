-- =========================================================================
-- SAFE DATA CLEANUP MIGRATION (NON-DESTRUCTIVE)
-- =========================================================================
-- Strips any authorization PIN (e.g. "(756673)") from existing 
-- entered_by and exited_by records in access_requests table.
-- =========================================================================

UPDATE public.access_requests
SET entered_by = regexp_replace(entered_by, '\s*\([^)]*\)', '', 'g')
WHERE entered_by IS NOT NULL AND entered_by ~ '\([^)]*\)';

UPDATE public.access_requests
SET exited_by = regexp_replace(exited_by, '\s*\([^)]*\)', '', 'g')
WHERE exited_by IS NOT NULL AND exited_by ~ '\([^)]*\)';
