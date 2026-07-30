-- Migration: 018_force_resolve_match.sql
-- Description: RPC for organizers to force-resolve a match using a single submission if the opponent didn't submit.

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
    -- 1. Get Match and Verify Permissions
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

    -- 2. Get Submission
    SELECT * INTO v_submission FROM match_submissions WHERE id = p_submission_id AND match_id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    -- 3. Parse Score (Format: "3-1" for Player1 - Player2)
    v_clean_score := REPLACE(v_submission.score_reported, ' ', '');
    BEGIN
        v_p1_score := split_part(v_clean_score, '-', 1)::INT;
        v_p2_score := split_part(v_clean_score, '-', 2)::INT;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid score format. Cannot force resolve.';
    END;

    -- 4. Determine Winner
    IF v_p1_score > v_p2_score THEN
        v_winner_id := v_match.player1_id;
        v_loser_id := v_match.player2_id;
    ELSIF v_p2_score > v_p1_score THEN
        v_winner_id := v_match.player2_id;
        v_loser_id := v_match.player1_id;
    ELSE
        RAISE EXCEPTION 'Draws are not allowed in elimination rounds.';
    END IF;

    -- 5. Update Matches
    UPDATE matches SET status = 'verified', winner_id = v_winner_id WHERE id = p_match_id;
    UPDATE match_submissions SET status = 'verified' WHERE match_id = p_match_id;

    -- 6. Update GLOBAL Stats
    UPDATE profiles SET 
        total_goals_scored = COALESCE(total_goals_scored, 0) + v_p1_score,
        total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p2_score
    WHERE id = v_match.player1_id;

    UPDATE profiles SET 
        total_goals_scored = COALESCE(total_goals_scored, 0) + v_p2_score,
        total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p1_score
    WHERE id = v_match.player2_id;

    -- 7. Update TOURNAMENT Stats
    -- Player 1
    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player1_id, v_p1_score, v_p2_score, CASE WHEN v_winner_id = v_match.player1_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + v_p1_score,
        goals_conceded = tournament_stats.goals_conceded + v_p2_score,
        wins = tournament_stats.wins + (CASE WHEN v_winner_id = v_match.player1_id THEN 1 ELSE 0 END),
        matches_played = tournament_stats.matches_played + 1;

    -- Player 2
    INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
    VALUES (v_match.tournament_id, v_match.player2_id, v_p2_score, v_p1_score, CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END, 1)
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET 
        goals_scored = tournament_stats.goals_scored + v_p2_score,
        goals_conceded = tournament_stats.goals_conceded + v_p1_score,
        wins = tournament_stats.wins + (CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END),
        matches_played = tournament_stats.matches_played + 1;

    -- 8. Advance Winner
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
