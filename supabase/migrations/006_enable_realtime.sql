-- Migration: 006_enable_realtime.sql
-- Description: Enable Supabase Realtime for matches and match_submissions tables

-- Turn on replica identity so realtime gets the OLD record data if needed
ALTER TABLE matches REPLICA IDENTITY FULL;
ALTER TABLE match_submissions REPLICA IDENTITY FULL;

-- Enable Realtime for these specific tables by adding them to the supabase_realtime publication
BEGIN;
  -- Remove them first just in case they are already there to avoid errors
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_submissions;
