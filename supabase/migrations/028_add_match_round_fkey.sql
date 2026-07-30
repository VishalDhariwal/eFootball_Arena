-- Migration: 028_add_match_round_fkey.sql
-- Description: Add foreign key constraint to matches.round_id so Supabase can resolve nested queries.

ALTER TABLE matches
  ADD CONSTRAINT matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
