-- =========================================================================
-- SAFE DATABASE MIGRATION: RENAME ALL "STYD.xxx" TICKETS TO RANDOM STRINGS
-- =========================================================================
-- This script updates all existing tickets in your database from the old
-- explicit "STYD.USFDCWBV-..." format to clean 12-character random lowercase strings.
-- No data is deleted!
-- =========================================================================

UPDATE public.access_requests
SET ticket_number = lower(substr(md5(random()::text || id::text), 1, 12))
WHERE ticket_number LIKE 'STYD.%' OR ticket_number ~ '[A-Z]';
