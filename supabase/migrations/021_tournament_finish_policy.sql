-- Migration: 021_tournament_finish_policy.sql
-- Description: Allow organizers and admins to mark a tournament as completed.
-- Also broadens the update policy so the auto-finish trigger from the frontend works.

-- Drop the narrow existing policy and replace with one that also covers admins
DO $$ BEGIN
  DROP POLICY IF EXISTS "Organizers can update their tournaments." ON tournaments;
EXCEPTION WHEN undefined_object THEN null; END $$;

-- New policy: organizer of the tournament OR admin can update
DO $$ BEGIN
  CREATE POLICY "Organizers and admins can update their tournaments"
  ON tournaments FOR UPDATE
  USING (
    auth.uid() = organizer_id
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = organizer_id
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
