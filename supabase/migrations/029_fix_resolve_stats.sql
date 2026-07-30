-- Migration: 029_fix_resolve_stats.sql
-- Description: Update resolve_dispute and force_resolve_match to pull accurate goals from match_detailed_stats (OCR) to update leaderboards.

CREATE OR REPLACE FUNCTION resolve_dispute(
    p_match_id UUID,
    p_winner_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_next_match_id UUID;
    v_position INT;
    v_tournament_id UUID;
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
    v_p1_score INT;
    v_p2_score INT;
BEGIN
    -- Get tournament info
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    SELECT organizer_id INTO v_organizer_id
    FROM tournaments 
    WHERE id = v_match.tournament_id;

    -- Check authorization
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can resolve disputes.';
    END IF;

    -- 1. Try to get accurate scores from match_detailed_stats (inserted by OCR)
    SELECT goals_scored, goals_conceded INTO v_p1_score, v_p2_score
    FROM match_detailed_stats
    WHERE match_id = p_match_id AND player_id = v_match.player1_id
    LIMIT 1;

    IF v_p1_score IS NULL THEN
        SELECT goals_conceded, goals_scored INTO v_p1_score, v_p2_score
        FROM match_detailed_stats
        WHERE match_id = p_match_id AND player_id = v_match.player2_id
        LIMIT 1;
    END IF;

    -- Fallback if no detailed stats exist (legacy/manual fallback)
    IF v_p1_score IS NULL THEN
        IF p_winner_id = v_match.player1_id THEN
            v_p1_score := 1; v_p2_score := 0;
        ELSE
            v_p1_score := 0; v_p2_score := 1;
        END IF;
    END IF;

    -- 2. Update the match to verified and set the winner
    UPDATE matches 
    SET status = 'verified', 
        winner_id = p_winner_id 
    WHERE id = p_match_id;

    UPDATE match_submissions SET status = 'verified' WHERE match_id = p_match_id;

    -- 3. Update Profiles Global Stats
    UPDATE profiles SET 
        total_goals_scored = COALESCE(total_goals_scored, 0) + v_p1_score,
        total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p2_score
    WHERE id = v_match.player1_id;

    UPDATE profiles SET 
        total_goals_scored = COALESCE(total_goals_scored, 0) + v_p2_score,
        total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p1_score
    WHERE id = v_match.player2_id;

    -- 4. Update Tournament Leaderboard (tournament_stats)
    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player1_id, v_p1_score, v_p2_score, CASE WHEN p_winner_id = v_match.player1_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + EXCLUDED.goals_scored,
        goals_conceded = tournament_stats.goals_conceded + EXCLUDED.goals_conceded,
        wins = tournament_stats.wins + EXCLUDED.wins,
        matches_played = tournament_stats.matches_played + 1;

    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player2_id, v_p2_score, v_p1_score, CASE WHEN p_winner_id = v_match.player2_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + EXCLUDED.goals_scored,
        goals_conceded = tournament_stats.goals_conceded + EXCLUDED.goals_conceded,
        wins = tournament_stats.wins + EXCLUDED.wins,
        matches_played = tournament_stats.matches_played + 1;

    -- 5. Advance Winner
    SELECT next_match_id, position 
    INTO v_next_match_id, v_position
    FROM brackets 
    WHERE match_id = p_match_id;

    IF v_next_match_id IS NOT NULL THEN
        IF v_position % 2 = 1 THEN
            UPDATE matches SET player1_id = p_winner_id WHERE id = v_next_match_id;
        ELSE
            UPDATE matches SET player2_id = p_winner_id WHERE id = v_next_match_id;
        END IF;
        
        PERFORM sweep_bracket(v_match.tournament_id);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION force_resolve_match(
    p_match_id UUID,
    p_submission_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    SELECT organizer_id INTO v_organizer_id
    FROM tournaments 
    WHERE id = v_match.tournament_id;

    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized to resolve this match';
    END IF;

    -- Try to get accurate scores from match_detailed_stats FIRST (if OCR was used)
    SELECT goals_scored, goals_conceded INTO v_p1_score, v_p2_score
    FROM match_detailed_stats
    WHERE match_id = p_match_id AND player_id = v_match.player1_id
    LIMIT 1;

    IF v_p1_score IS NULL THEN
        SELECT goals_conceded, goals_scored INTO v_p1_score, v_p2_score
        FROM match_detailed_stats
        WHERE match_id = p_match_id AND player_id = v_match.player2_id
        LIMIT 1;
    END IF;

    -- If no detailed stats exist, fallback to parsing the submission string
    IF v_p1_score IS NULL THEN
        SELECT * INTO v_submission FROM match_submissions WHERE id = p_submission_id AND match_id = p_match_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Submission not found';
        END IF;

        v_clean_score := REPLACE(v_submission.score_reported, ' ', '');
        BEGIN
            v_p1_score := split_part(v_clean_score, '-', 1)::INT;
            v_p2_score := split_part(v_clean_score, '-', 2)::INT;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid score format. Cannot force resolve without detailed stats.';
        END;
    END IF;

    -- Determine Winner
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
        goals_scored = tournament_stats.goals_scored + EXCLUDED.goals_scored,
        goals_conceded = tournament_stats.goals_conceded + EXCLUDED.goals_conceded,
        wins = tournament_stats.wins + EXCLUDED.wins,
        matches_played = tournament_stats.matches_played + 1;

    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player2_id, v_p2_score, v_p1_score, CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + EXCLUDED.goals_scored,
        goals_conceded = tournament_stats.goals_conceded + EXCLUDED.goals_conceded,
        wins = tournament_stats.wins + EXCLUDED.wins,
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
$$;
