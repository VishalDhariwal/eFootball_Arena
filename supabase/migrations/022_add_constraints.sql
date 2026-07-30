-- Migration: 022_add_constraints.sql
-- Description: Adds hard PostgreSQL constraints to enforce database integrity independent of frontend checks.

-- 1. One Submission Per Player Per Match
-- Prevents players from spamming the database with multiple submissions for the same match.
ALTER TABLE match_submissions 
DROP CONSTRAINT IF EXISTS unique_match_player_submission;

ALTER TABLE match_submissions
ADD CONSTRAINT unique_match_player_submission UNIQUE (match_id, player_id);

-- 2. Prevent Duplicate Registrations
-- Prevents a player from registering multiple times for the same tournament.
ALTER TABLE registrations 
DROP CONSTRAINT IF EXISTS unique_tournament_user_registration;

ALTER TABLE registrations
ADD CONSTRAINT unique_tournament_user_registration UNIQUE (tournament_id, user_id);

-- 3. Invalid Tournament States
-- Ensure the status column strictly adheres to predefined application states.
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS check_tournament_status;

ALTER TABLE tournaments
ADD CONSTRAINT check_tournament_status 
CHECK (status IN ('upcoming', 'registration', 'live', 'completed'));

-- 4. Prevent Submissions After Deadlines
-- Uses a trigger to strictly reject any submission if the match deadline has passed.
CREATE OR REPLACE FUNCTION enforce_submission_deadline()
RETURNS TRIGGER AS $$
DECLARE
    v_deadline TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT deadline INTO v_deadline FROM matches WHERE id = NEW.match_id;
    
    -- Allow a small 5-minute grace period if needed, or enforce strictly.
    -- We enforce strictly based on the exact deadline time.
    IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
        RAISE EXCEPTION 'Submission rejected: The deadline for this match has passed.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_submission_deadline ON match_submissions;

CREATE TRIGGER trigger_enforce_submission_deadline
BEFORE INSERT ON match_submissions
FOR EACH ROW
EXECUTE FUNCTION enforce_submission_deadline();
