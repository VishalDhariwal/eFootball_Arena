-- Migration: 020_fix_detailed_stats_rls.sql
-- Description: Allow organizers and admins to insert/update detailed stats for any match they manage.

-- Allow organizers to insert/upsert stats for matches in their tournaments
DO $$ BEGIN
  CREATE POLICY "Organizers can upsert match detailed stats"
  ON match_detailed_stats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = match_detailed_stats.match_id
      AND t.organizer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Also allow organizers to update/overwrite
DO $$ BEGIN
  CREATE POLICY "Organizers can update match detailed stats"
  ON match_detailed_stats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournaments t ON m.tournament_id = t.id
      WHERE m.id = match_detailed_stats.match_id
      AND t.organizer_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
