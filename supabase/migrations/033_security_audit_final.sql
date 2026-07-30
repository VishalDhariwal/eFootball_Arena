-- Migration: 033_security_audit_final.sql
-- Description: Locks down profile columns, adds comprehensive registration validation, and secures detailed stats.

-- ==========================================
-- 1. Prevent Profile Tampering (Trigger)
-- ==========================================
CREATE OR REPLACE FUNCTION prevent_protected_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- If the user modifying the row is NOT the service_role (superuser)
    IF auth.role() = 'authenticated' THEN
        -- Check if the current user is an admin
        IF NOT EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        ) THEN
            -- Forcefully reset protected columns to their previous state
            NEW.status = OLD.status;
            NEW.elo_rating = OLD.elo_rating;
            NEW.total_goals_scored = OLD.total_goals_scored;
            NEW.total_goals_conceded = OLD.total_goals_conceded;
            NEW.created_at = OLD.created_at;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_profile_security ON profiles;
CREATE TRIGGER enforce_profile_security
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_protected_profile_updates();


-- ==========================================
-- 2. Comprehensive Registration Validation (Trigger)
-- ==========================================
CREATE OR REPLACE FUNCTION validate_tournament_registration()
RETURNS TRIGGER AS $$
DECLARE
    v_tournament RECORD;
    v_profile_status TEXT;
    v_current_players INT;
BEGIN
    -- 0. Defense-in-depth: Ensure user is registering themselves (unless admin)
    IF auth.role() = 'authenticated' AND NEW.user_id != auth.uid() THEN
        IF NOT EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.name = 'admin'
        ) THEN
            RAISE EXCEPTION 'You can only register for yourself.';
        END IF;
    END IF;

    -- 1. Validate Tournament Existence & Status
    -- We use FOR UPDATE to lock the tournament row, serializing capacity checks to prevent race conditions
    SELECT * INTO v_tournament FROM tournaments WHERE id = NEW.tournament_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament does not exist.';
    END IF;
    
    IF v_tournament.status NOT IN ('upcoming', 'registration') THEN
        RAISE EXCEPTION 'Cannot register. Tournament is no longer accepting registrations.';
    END IF;

    -- 2. Validate Player Profile Approval
    SELECT status INTO v_profile_status FROM profiles WHERE id = NEW.user_id;
    IF v_profile_status != 'approved' THEN
        RAISE EXCEPTION 'Your account must be approved by an admin before you can register for tournaments.';
    END IF;

    -- 3. Validate Tournament Capacity
    IF v_tournament.max_players IS NOT NULL THEN
        -- Count current registrations (both pending and approved to prevent overbooking)
        SELECT COUNT(*) INTO v_current_players FROM registrations WHERE tournament_id = NEW.tournament_id;
        IF v_current_players >= v_tournament.max_players THEN
            RAISE EXCEPTION 'Tournament has reached maximum capacity.';
        END IF;
    END IF;

    -- Note: Duplicate registrations are already prevented by the UNIQUE(tournament_id, user_id) constraint on the table.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_registration_rules ON registrations;
CREATE TRIGGER enforce_registration_rules
BEFORE INSERT ON registrations
FOR EACH ROW
EXECUTE FUNCTION validate_tournament_registration();


-- ==========================================
-- 3. Secure Detailed Stats (Policy Drop)
-- ==========================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert their own stats" ON match_detailed_stats;
EXCEPTION WHEN undefined_object THEN null; END $$;
