-- Migration: 023_business_logic_rpcs.sql
-- Description: Move sensitive mutations from direct table updates to secure RPCs.

-- 1. Approve or Reject Registration
CREATE OR REPLACE FUNCTION rpc_update_registration_status(
    p_registration_id UUID,
    p_status TEXT
)
RETURNS VOID AS $$
DECLARE
    v_tournament_id UUID;
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
    v_current_approved INT;
    v_max_players INT;
BEGIN
    -- Validate status
    IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
        RAISE EXCEPTION 'Invalid status. Must be approved, rejected, or pending.';
    END IF;

    -- Get tournament info
    SELECT t.id, t.organizer_id, t.max_players INTO v_tournament_id, v_organizer_id, v_max_players
    FROM registrations r
    JOIN tournaments t ON r.tournament_id = t.id
    WHERE r.id = p_registration_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found.';
    END IF;

    -- Check if user is organizer or admin
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can update registrations.';
    END IF;

    -- If approving, enforce max_players limit
    IF p_status = 'approved' AND v_max_players IS NOT NULL THEN
        SELECT COUNT(*) INTO v_current_approved 
        FROM registrations 
        WHERE tournament_id = v_tournament_id AND registration_status = 'approved';
        
        IF v_current_approved >= v_max_players THEN
            RAISE EXCEPTION 'Cannot approve: Tournament has reached its maximum player limit.';
        END IF;
    END IF;

    UPDATE registrations SET registration_status = p_status WHERE id = p_registration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update Match Schedule
CREATE OR REPLACE FUNCTION rpc_update_match_schedule(
    p_match_id UUID,
    p_scheduled_time TIMESTAMP WITH TIME ZONE,
    p_deadline TIMESTAMP WITH TIME ZONE
)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get tournament organizer
    SELECT t.organizer_id INTO v_organizer_id
    FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = p_match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found.';
    END IF;

    -- Check authorization
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can update deadlines.';
    END IF;

    UPDATE matches SET scheduled_time = p_scheduled_time, deadline = p_deadline WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update Tournament Status (Start / Finish / Revert)
CREATE OR REPLACE FUNCTION rpc_update_tournament_status(
    p_tournament_id UUID,
    p_status TEXT
)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Validate status
    IF p_status NOT IN ('upcoming', 'registration', 'live', 'completed') THEN
        RAISE EXCEPTION 'Invalid tournament status.';
    END IF;

    SELECT organizer_id INTO v_organizer_id
    FROM tournaments WHERE id = p_tournament_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found.';
    END IF;

    -- Check authorization
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can update tournament status.';
    END IF;

    UPDATE tournaments SET status = p_status WHERE id = p_tournament_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Submit Detailed Match Stats
CREATE OR REPLACE FUNCTION rpc_upsert_detailed_stats(
    p_match_id UUID,
    p_player_id UUID,
    p_goals_scored INT,
    p_goals_conceded INT,
    p_possession DECIMAL,
    p_shots INT,
    p_shots_on_target INT,
    p_passes INT,
    p_pass_accuracy DECIMAL,
    p_interceptions INT,
    p_tackles INT,
    p_saves INT,
    p_fouls INT
)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get tournament organizer
    SELECT t.organizer_id INTO v_organizer_id
    FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = p_match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found.';
    END IF;

    -- Check authorization
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can upsert detailed stats.';
    END IF;

    -- Upsert the stats
    INSERT INTO match_detailed_stats (
        match_id, player_id, goals_scored, goals_conceded, possession, shots, shots_on_target, 
        passes, pass_accuracy, interceptions, tackles, saves, fouls
    ) VALUES (
        p_match_id, p_player_id, p_goals_scored, p_goals_conceded, p_possession, p_shots, p_shots_on_target, 
        p_passes, p_pass_accuracy, p_interceptions, p_tackles, p_saves, p_fouls
    )
    ON CONFLICT (match_id, player_id) DO UPDATE SET
        goals_scored = EXCLUDED.goals_scored,
        goals_conceded = EXCLUDED.goals_conceded,
        possession = EXCLUDED.possession,
        shots = EXCLUDED.shots,
        shots_on_target = EXCLUDED.shots_on_target,
        passes = EXCLUDED.passes,
        pass_accuracy = EXCLUDED.pass_accuracy,
        interceptions = EXCLUDED.interceptions,
        tackles = EXCLUDED.tackles,
        saves = EXCLUDED.saves,
        fouls = EXCLUDED.fouls;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
