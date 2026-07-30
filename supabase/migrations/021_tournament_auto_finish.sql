-- 1. Update RLS so organizers and admins can properly mark tournaments as completed
DO $$ BEGIN
  DROP POLICY IF EXISTS "Organizers can update their tournaments." ON tournaments;
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Organizers and admins can update their tournaments"
  ON tournaments FOR UPDATE
  USING (
    auth.uid() = organizer_id
    OR EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = organizer_id
    OR EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create an auto-finish trigger so the database automatically marks the tournament 
--    as completed when the final match gets a winner.
CREATE OR REPLACE FUNCTION auto_finish_tournament()
RETURNS TRIGGER AS $$
DECLARE
    v_has_unfinished_matches BOOLEAN;
BEGIN
    -- Only run this if a winner was just set
    IF NEW.winner_id IS NOT NULL AND (OLD.winner_id IS NULL OR OLD.winner_id != NEW.winner_id) THEN
        -- Check if there are any matches left in this tournament that do NOT have a winner (and are not walkovers/cancelled)
        SELECT EXISTS (
            SELECT 1 FROM matches 
            WHERE tournament_id = NEW.tournament_id 
            AND winner_id IS NULL 
            AND status NOT IN ('walkover', 'cancelled')
        ) INTO v_has_unfinished_matches;
        
        -- If all matches are done, mark tournament as completed
        IF NOT v_has_unfinished_matches THEN
            UPDATE tournaments SET status = 'completed' WHERE id = NEW.tournament_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_auto_finish_tournament ON matches;
CREATE TRIGGER trigger_auto_finish_tournament
AFTER UPDATE OF winner_id ON matches
FOR EACH ROW
EXECUTE FUNCTION auto_finish_tournament();

-- 3. Fix any currently stuck tournaments (like "champ 4")
UPDATE tournaments t
SET status = 'completed'
WHERE status = 'live'
AND NOT EXISTS (
    SELECT 1 FROM matches m 
    WHERE m.tournament_id = t.id 
    AND m.winner_id IS NULL 
    AND m.status NOT IN ('walkover', 'cancelled')
);
