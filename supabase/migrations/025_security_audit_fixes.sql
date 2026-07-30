-- Migration: 025_security_audit_fixes.sql
-- Description: Fixes critical privilege escalation and state transition vulnerabilities found during the security audit.

-- 1. Secure resolve_dispute
-- Adds strict authorization check and SET search_path = public
CREATE OR REPLACE FUNCTION resolve_dispute(
    p_match_id UUID,
    p_winner_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_next_match_id UUID;
    v_position INT;
    v_tournament_id UUID;
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Get tournament info
    SELECT t.id, t.organizer_id INTO v_tournament_id, v_organizer_id
    FROM matches m
    JOIN tournaments t ON m.tournament_id = t.id
    WHERE m.id = p_match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    -- Check authorization
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can resolve disputes.';
    END IF;

    -- 1. Update the match to verified and set the winner
    UPDATE matches 
    SET status = 'verified', 
        winner_id = p_winner_id 
    WHERE id = p_match_id;

    -- 2. Find the next match in the bracket and get tournament_id
    SELECT next_match_id, position 
    INTO v_next_match_id, v_position
    FROM brackets 
    WHERE match_id = p_match_id;

    -- 3. If there is a next match, advance the winner
    IF v_next_match_id IS NOT NULL THEN
        -- Odd positions (1, 3, 5) go to player1 slot
        -- Even positions (2, 4, 6) go to player2 slot
        IF v_position % 2 = 1 THEN
            UPDATE matches SET player1_id = p_winner_id WHERE id = v_next_match_id;
        ELSE
            UPDATE matches SET player2_id = p_winner_id WHERE id = v_next_match_id;
        END IF;
        
        -- Run sweep to auto-resolve any empty branches this winner just entered
        PERFORM sweep_bracket(v_tournament_id);
    END IF;
END;
$$;


-- 2. Secure sweep_bracket
-- Adds authorization check and SET search_path = public
CREATE OR REPLACE FUNCTION sweep_bracket(p_tournament_id UUID)
RETURNS VOID AS $$
DECLARE
    v_round RECORD;
    v_match RECORD;
    v_prev_m1_status TEXT;
    v_prev_m2_status TEXT;
    v_new_winner UUID;
    v_next_match_id UUID;
    v_position INT;
    v_slot1_empty BOOLEAN;
    v_slot2_empty BOOLEAN;
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Check authorization
    SELECT organizer_id INTO v_organizer_id FROM tournaments WHERE id = p_tournament_id;
    
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    -- sweep_bracket can be called directly by organizers/admins, or internally by trigger/RPC
    -- If it's called internally by a SECURITY DEFINER function, auth.uid() might be the original caller.
    -- We allow it if the user is the organizer, an admin, or if it's called by a trigger where we trust it.
    -- Actually, to be safe, if we restrict it strictly, it might break internal calls if they don't propagate properly.
    -- Wait, SECURITY DEFINER functions change current_user, but not auth.uid().
    IF auth.uid() IS NOT NULL AND auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can sweep brackets manually.';
    END IF;

    -- Loop through rounds from 1 to Total
    FOR v_round IN 
        SELECT id FROM rounds 
        WHERE tournament_id = p_tournament_id 
        ORDER BY order_index ASC 
    LOOP
        -- Loop through matches in this round
        FOR v_match IN 
            SELECT * FROM matches 
            WHERE round_id = v_round.id 
            AND status = 'scheduled'
        LOOP
            v_prev_m1_status := NULL;
            v_prev_m2_status := NULL;
            v_new_winner := NULL;

            -- Find previous matches feeding into this one
            SELECT status INTO v_prev_m1_status FROM matches 
            WHERE id = (SELECT match_id FROM brackets WHERE next_match_id = v_match.id AND position % 2 = 1);
            
            SELECT status INTO v_prev_m2_status FROM matches 
            WHERE id = (SELECT match_id FROM brackets WHERE next_match_id = v_match.id AND position % 2 = 0);
            
            -- A slot is empty if it has no player AND (there is no previous match OR previous match is cancelled)
            v_slot1_empty := (v_match.player1_id IS NULL AND (v_prev_m1_status = 'cancelled' OR v_prev_m1_status IS NULL));
            v_slot2_empty := (v_match.player2_id IS NULL AND (v_prev_m2_status = 'cancelled' OR v_prev_m2_status IS NULL));
            
            IF v_slot1_empty AND v_slot2_empty THEN
                UPDATE matches SET status = 'cancelled' WHERE id = v_match.id;
            ELSIF v_slot1_empty AND v_match.player2_id IS NOT NULL THEN
                v_new_winner := v_match.player2_id;
                UPDATE matches SET status = 'walkover', winner_id = v_new_winner WHERE id = v_match.id;
            ELSIF v_slot2_empty AND v_match.player1_id IS NOT NULL THEN
                v_new_winner := v_match.player1_id;
                UPDATE matches SET status = 'walkover', winner_id = v_new_winner WHERE id = v_match.id;
            END IF;

            -- If we determined a walkover winner, push them to the next match immediately
            IF v_new_winner IS NOT NULL THEN
                SELECT next_match_id, position INTO v_next_match_id, v_position 
                FROM brackets WHERE match_id = v_match.id;
                
                IF v_next_match_id IS NOT NULL THEN
                    IF v_position % 2 = 1 THEN
                        UPDATE matches SET player1_id = v_new_winner WHERE id = v_next_match_id;
                    ELSE
                        UPDATE matches SET player2_id = v_new_winner WHERE id = v_next_match_id;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Secure Bracket Generation State Transitions & Path
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(
    p_tournament_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_round_duration_minutes INT
)
RETURNS VOID AS $$
DECLARE
    v_players UUID[];
    v_num_players INT;
    v_p INT;
    v_total_rounds INT;
    v_round_ids UUID[];
    v_next_match_ids UUID[];
    v_round_names TEXT[] := ARRAY['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Round of 64', 'Round of 128'];
    v_player_index INT := 1;
    v_status TEXT;
BEGIN
    -- 0. Check if caller is authorized (organizer)
    SELECT status INTO v_status FROM tournaments 
    WHERE id = p_tournament_id AND organizer_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not authorized. Only the tournament organizer can generate the bracket.';
    END IF;

    -- Security Fix: Ensure tournament is in registration or upcoming phase
    IF v_status NOT IN ('registration', 'upcoming') THEN
        RAISE EXCEPTION 'Cannot generate bracket: Tournament is not in registration or upcoming phase.';
    END IF;

    -- 1. Get all paid players in random order
    SELECT array_agg(user_id ORDER BY random())
    INTO v_players
    FROM registrations
    WHERE tournament_id = p_tournament_id AND payment_status = 'paid';

    v_num_players := array_length(v_players, 1);
    
    IF v_num_players IS NULL OR v_num_players < 2 THEN
        RAISE EXCEPTION 'Not enough paid players to generate a bracket (minimum 2).';
    END IF;

    -- 2. Calculate power of 2
    v_p := 1;
    v_total_rounds := 0;
    WHILE v_p < v_num_players LOOP
        v_p := v_p * 2;
        v_total_rounds := v_total_rounds + 1;
    END LOOP;

    -- 3. Create Rounds
    v_round_ids := ARRAY[]::UUID[];
    FOR r IN 1..v_total_rounds LOOP
        DECLARE
            v_round_id UUID := gen_random_uuid();
            v_round_name TEXT;
        BEGIN
            IF (v_total_rounds - r + 1) <= array_length(v_round_names, 1) THEN
                v_round_name := v_round_names[v_total_rounds - r + 1];
            ELSE
                v_round_name := 'Round ' || r;
            END IF;

            INSERT INTO rounds (id, tournament_id, name, order_index)
            VALUES (v_round_id, p_tournament_id, v_round_name, r);
            
            v_round_ids := array_append(v_round_ids, v_round_id);
        END;
    END LOOP;

    -- 4. Create Matches
    v_next_match_ids := ARRAY[]::UUID[];
    
    FOR r IN REVERSE v_total_rounds..1 LOOP
        DECLARE
            v_matches_in_round INT := power(2, v_total_rounds - r);
            v_current_round_match_ids UUID[] := ARRAY[]::UUID[];
            v_round_start TIMESTAMP WITH TIME ZONE := p_start_time + ((r - 1) * p_round_duration_minutes * interval '1 minute');
            v_round_deadline TIMESTAMP WITH TIME ZONE := v_round_start + (p_round_duration_minutes * interval '1 minute');
        BEGIN
            FOR m IN 1..v_matches_in_round LOOP
                DECLARE
                    v_match_id UUID := gen_random_uuid();
                    v_next_id UUID := NULL;
                    v_p1 UUID := NULL;
                    v_p2 UUID := NULL;
                    v_status_match TEXT := 'scheduled';
                BEGIN
                    IF r < v_total_rounds THEN
                        v_next_id := v_next_match_ids[ceiling(m::numeric / 2.0)];
                    END IF;

                    IF r = 1 THEN
                        IF v_player_index <= v_num_players THEN
                            v_p1 := v_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        
                        IF v_player_index <= v_num_players THEN
                            v_p2 := v_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;

                        IF v_p1 IS NOT NULL AND v_p2 IS NULL THEN
                            v_status_match := 'walkover';
                        ELSIF v_p1 IS NULL AND v_p2 IS NOT NULL THEN
                            v_status_match := 'walkover';
                        END IF;
                    END IF;

                    INSERT INTO matches (id, tournament_id, round_id, player1_id, player2_id, status, scheduled_time, deadline)
                    VALUES (v_match_id, p_tournament_id, v_round_ids[r], v_p1, v_p2, v_status_match, v_round_start, v_round_deadline);

                    INSERT INTO brackets (tournament_id, match_id, next_match_id, position)
                    VALUES (p_tournament_id, v_match_id, v_next_id, m);

                    v_current_round_match_ids := array_append(v_current_round_match_ids, v_match_id);
                END;
            END LOOP;
            
            v_next_match_ids := v_current_round_match_ids;
        END;
    END LOOP;

    -- 5. Update tournament status
    UPDATE tournaments SET status = 'live' WHERE id = p_tournament_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. Secure Storage Policies
-- We drop the overly permissive policy and create one that validates the uploader's user ID is in the path.
-- The upload path used by frontend is: matchId/userId/filename
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated Users can upload screenshots" ON storage.objects;
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Users can upload their own screenshots" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'match_screenshots' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add a policy allowing users to update/delete their own uploads if they need to replace a screenshot
DO $$ BEGIN
  CREATE POLICY "Users can manage their own screenshots" 
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'match_screenshots' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'match_screenshots' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 5. Apply SET search_path = public to all remaining SECURITY DEFINER functions

-- 5.1 manual bracket
CREATE OR REPLACE FUNCTION generate_manual_bracket(
    p_tournament_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_round_duration_minutes INT,
    p_players UUID[]
)
RETURNS VOID AS $$
DECLARE
    v_num_players INT;
    v_p INT;
    v_total_rounds INT;
    v_round_ids UUID[];
    v_next_match_ids UUID[];
    v_round_names TEXT[] := ARRAY['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Round of 64', 'Round of 128'];
    v_player_index INT := 1;
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM tournaments 
    WHERE id = p_tournament_id AND organizer_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not authorized. Only the tournament organizer can generate the bracket.';
    END IF;

    IF v_status NOT IN ('registration', 'upcoming') THEN
        RAISE EXCEPTION 'Cannot generate bracket: Tournament is not in registration or upcoming phase.';
    END IF;

    v_num_players := array_length(p_players, 1);
    
    IF v_num_players IS NULL OR v_num_players < 2 THEN
        RAISE EXCEPTION 'Not enough players to generate a bracket (minimum 2).';
    END IF;

    v_p := 1;
    v_total_rounds := 0;
    WHILE v_p < v_num_players LOOP
        v_p := v_p * 2;
        v_total_rounds := v_total_rounds + 1;
    END LOOP;

    v_round_ids := ARRAY[]::UUID[];
    FOR r IN 1..v_total_rounds LOOP
        DECLARE
            v_round_id UUID := gen_random_uuid();
            v_round_name TEXT;
        BEGIN
            IF (v_total_rounds - r + 1) <= array_length(v_round_names, 1) THEN
                v_round_name := v_round_names[v_total_rounds - r + 1];
            ELSE
                v_round_name := 'Round ' || r;
            END IF;

            INSERT INTO rounds (id, tournament_id, name, order_index)
            VALUES (v_round_id, p_tournament_id, v_round_name, r);
            
            v_round_ids := array_append(v_round_ids, v_round_id);
        END;
    END LOOP;

    v_next_match_ids := ARRAY[]::UUID[];
    
    FOR r IN REVERSE v_total_rounds..1 LOOP
        DECLARE
            v_matches_in_round INT := power(2, v_total_rounds - r);
            v_current_round_match_ids UUID[] := ARRAY[]::UUID[];
            v_round_start TIMESTAMP WITH TIME ZONE := p_start_time + ((r - 1) * p_round_duration_minutes * interval '1 minute');
            v_round_deadline TIMESTAMP WITH TIME ZONE := v_round_start + (p_round_duration_minutes * interval '1 minute');
        BEGIN
            FOR m IN 1..v_matches_in_round LOOP
                DECLARE
                    v_match_id UUID := gen_random_uuid();
                    v_next_id UUID := NULL;
                    v_p1 UUID := NULL;
                    v_p2 UUID := NULL;
                    v_status_match TEXT := 'scheduled';
                BEGIN
                    IF r < v_total_rounds THEN
                        v_next_id := v_next_match_ids[ceiling(m::numeric / 2.0)];
                    END IF;

                    IF r = 1 THEN
                        IF v_player_index <= v_num_players THEN
                            v_p1 := p_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        
                        IF v_player_index <= v_num_players THEN
                            v_p2 := p_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;

                        IF v_p1 IS NOT NULL AND v_p2 IS NULL THEN
                            v_status_match := 'walkover';
                        ELSIF v_p1 IS NULL AND v_p2 IS NOT NULL THEN
                            v_status_match := 'walkover';
                        END IF;
                    END IF;

                    INSERT INTO matches (id, tournament_id, round_id, player1_id, player2_id, status, scheduled_time, deadline)
                    VALUES (v_match_id, p_tournament_id, v_round_ids[r], v_p1, v_p2, v_status_match, v_round_start, v_round_deadline);

                    INSERT INTO brackets (tournament_id, match_id, next_match_id, position)
                    VALUES (p_tournament_id, v_match_id, v_next_id, m);

                    v_current_round_match_ids := array_append(v_current_round_match_ids, v_match_id);
                END;
            END LOOP;
            
            v_next_match_ids := v_current_round_match_ids;
        END;
    END LOOP;

    UPDATE tournaments SET status = 'live' WHERE id = p_tournament_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5.2 auto_finish_tournament trigger
CREATE OR REPLACE FUNCTION auto_finish_tournament()
RETURNS TRIGGER AS $$
DECLARE
    v_has_unfinished_matches BOOLEAN;
BEGIN
    IF NEW.winner_id IS NOT NULL AND (OLD.winner_id IS NULL OR OLD.winner_id != NEW.winner_id) THEN
        SELECT EXISTS (
            SELECT 1 FROM matches 
            WHERE tournament_id = NEW.tournament_id 
            AND winner_id IS NULL 
            AND status NOT IN ('walkover', 'cancelled')
        ) INTO v_has_unfinished_matches;
        
        IF NOT v_has_unfinished_matches THEN
            UPDATE tournaments SET status = 'completed' WHERE id = NEW.tournament_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5.3 verify_match_score trigger
CREATE OR REPLACE FUNCTION verify_match_score()
RETURNS TRIGGER AS $$
DECLARE
    v_other_submission RECORD;
    v_match RECORD;
    v_winner_id UUID;
    v_p1_score INT;
    v_p2_score INT;
    v_clean_new_score TEXT;
    v_clean_other_score TEXT;
BEGIN
    v_clean_new_score := REPLACE(NEW.score_reported, ' ', '');

    SELECT * INTO v_other_submission
    FROM match_submissions
    WHERE match_id = NEW.match_id AND player_id != NEW.player_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_clean_other_score := REPLACE(v_other_submission.score_reported, ' ', '');
        
        IF v_clean_new_score = v_clean_other_score THEN
            SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;

            BEGIN
                v_p1_score := split_part(v_clean_new_score, '-', 1)::INT;
                v_p2_score := split_part(v_clean_new_score, '-', 2)::INT;
            EXCEPTION WHEN OTHERS THEN
                UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
                RETURN NEW;
            END;

            IF v_p1_score > v_p2_score THEN
                v_winner_id := v_match.player1_id;
            ELSIF v_p2_score > v_p1_score THEN
                v_winner_id := v_match.player2_id;
            ELSE
                UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
                RETURN NEW;
            END IF;

            UPDATE matches SET status = 'verified', winner_id = v_winner_id WHERE id = NEW.match_id;

            DECLARE
                v_next_match_id UUID;
                v_position INT;
            BEGIN
                SELECT next_match_id, position INTO v_next_match_id, v_position 
                FROM brackets WHERE match_id = NEW.match_id;

                IF v_next_match_id IS NOT NULL THEN
                    IF v_position % 2 = 1 THEN
                        UPDATE matches SET player1_id = v_winner_id WHERE id = v_next_match_id;
                    ELSE
                        UPDATE matches SET player2_id = v_winner_id WHERE id = v_next_match_id;
                    END IF;
                    
                    PERFORM sweep_bracket(v_match.tournament_id);
                END IF;
            END;
        ELSE
            UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
        END IF;
    ELSE
        UPDATE matches SET status = 'waiting_submission' WHERE id = NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5.4 force_resolve_match
CREATE OR REPLACE FUNCTION force_resolve_match(
    p_match_id UUID,
    p_submission_id UUID
)
RETURNS void AS $$
DECLARE
    v_match RECORD;
    v_submission RECORD;
    v_winner_id UUID;
    v_loser_id UUID;
    v_p1_score INT;
    v_p2_score INT;
    v_clean_score TEXT;
    v_next_match_id UUID;
    v_position INT;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF NOT (
        EXISTS (SELECT 1 FROM tournaments WHERE id = v_match.tournament_id AND organizer_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'admin')
    ) THEN
        RAISE EXCEPTION 'Not authorized to resolve this match';
    END IF;

    SELECT * INTO v_submission FROM match_submissions WHERE id = p_submission_id AND match_id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    v_clean_score := REPLACE(v_submission.score_reported, ' ', '');
    BEGIN
        v_p1_score := split_part(v_clean_score, '-', 1)::INT;
        v_p2_score := split_part(v_clean_score, '-', 2)::INT;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid score format. Cannot force resolve.';
    END;

    IF v_p1_score > v_p2_score THEN
        v_winner_id := v_match.player1_id;
        v_loser_id := v_match.player2_id;
    ELSIF v_p2_score > v_p1_score THEN
        v_winner_id := v_match.player2_id;
        v_loser_id := v_match.player1_id;
    ELSE
        RAISE EXCEPTION 'Draws are not allowed in elimination rounds.';
    END IF;

    UPDATE matches SET status = 'verified', winner_id = v_winner_id WHERE id = p_match_id;
    UPDATE match_submissions SET status = 'verified' WHERE match_id = p_match_id;

    UPDATE profiles SET 
        total_goals_scored = COALESCE(total_goals_scored, 0) + v_p1_score,
        total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p2_score
    WHERE id = v_match.player1_id;

    UPDATE profiles SET 
        total_goals_scored = COALESCE(total_goals_scored, 0) + v_p2_score,
        total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p1_score
    WHERE id = v_match.player2_id;

    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player1_id, v_p1_score, v_p2_score, CASE WHEN v_winner_id = v_match.player1_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + v_p1_score,
        goals_conceded = tournament_stats.goals_conceded + v_p2_score,
        wins = tournament_stats.wins + (CASE WHEN v_winner_id = v_match.player1_id THEN 1 ELSE 0 END),
        matches_played = tournament_stats.matches_played + 1;

    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player2_id, v_p2_score, v_p1_score, CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + v_p2_score,
        goals_conceded = tournament_stats.goals_conceded + v_p1_score,
        wins = tournament_stats.wins + (CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END),
        matches_played = tournament_stats.matches_played + 1;

    SELECT next_match_id, position 
    INTO v_next_match_id, v_position 
    FROM brackets 
    WHERE match_id = p_match_id;

    IF v_next_match_id IS NOT NULL THEN
        IF v_position % 2 = 1 THEN
            UPDATE matches SET player1_id = v_winner_id WHERE id = v_next_match_id;
        ELSE
            UPDATE matches SET player2_id = v_winner_id WHERE id = v_next_match_id;
        END IF;
        
        PERFORM sweep_bracket(v_match.tournament_id);
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5.5 revert_tournament
CREATE OR REPLACE FUNCTION revert_tournament(
    p_tournament_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM tournaments 
        WHERE id = p_tournament_id AND organizer_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) THEN
        RAISE EXCEPTION 'Not authorized. Only the tournament organizer or admin can revert.';
    END IF;

    DELETE FROM brackets WHERE tournament_id = p_tournament_id;
    DELETE FROM matches WHERE tournament_id = p_tournament_id;
    DELETE FROM rounds WHERE tournament_id = p_tournament_id;
    
    UPDATE tournaments SET status = 'registration' WHERE id = p_tournament_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
