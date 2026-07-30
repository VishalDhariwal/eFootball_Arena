-- Migration: 024_restrict_table_updates.sql
-- Description: Revoke direct UPDATE access to core tables from the frontend.
-- All state changes must now go through the RPCs created in 023_business_logic_rpcs.sql.

-- 1. Tournaments
DROP POLICY IF EXISTS "Organizers can update their tournaments" ON tournaments;
DROP POLICY IF EXISTS "Organizers and admins can update their tournaments" ON tournaments;
-- We leave INSERT and DELETE, but UPDATE is now blocked completely (unless via RPC/Service Role).

-- 2. Matches
DROP POLICY IF EXISTS "Tournament organizers can update matches" ON matches;
-- Updates (like setting a deadline or winner) must go through RPCs.

-- 3. Registrations
DROP POLICY IF EXISTS "Tournament organizers can update registrations" ON registrations;
-- Approving/rejecting must go through `rpc_update_registration_status`.

-- 4. Match Detailed Stats
DROP POLICY IF EXISTS "Organizers and admins can upsert detailed stats" ON match_detailed_stats;
-- We don't want direct upserts anymore, use `rpc_upsert_detailed_stats` instead.
