-- Migration: 019_fix_trigger_permissions.sql
-- Description: Adds SECURITY DEFINER to the verify_match_score trigger so it can bypass RLS when updating matches and stats.

CREATE OR REPLACE FUNCTION verify_match_score()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_other_submission RECORD;
    v_match RECORD;
    v_winner_id UUID;
    v_loser_id UUID;
    v_p1_score INT;
    v_p2_score INT;
    v_clean_new_score TEXT;
    v_clean_other_score TEXT;
BEGIN
    -- Remove spaces for clean comparison
    v_clean_new_score := REPLACE(NEW.score_reported, ' ', '');

    -- Check if there is another submission for this match by the opponent
    SELECT * INTO v_other_submission
    FROM match_submissions
    WHERE match_id = NEW.match_id AND player_id != NEW.player_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_clean_other_score := REPLACE(v_other_submission.score_reported, ' ', '');
        
        -- Both have submitted
        IF v_clean_new_score = v_clean_other_score THEN
            -- Scores match. Determine winner based on the score format "P1-P2"
            SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;

            BEGIN
                v_p1_score := split_part(v_clean_new_score, '-', 1)::INT;
                v_p2_score := split_part(v_clean_new_score, '-', 2)::INT;
            EXCEPTION WHEN OTHERS THEN
                -- If parsing fails, flag as disputed
                UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
                RETURN NEW;
            END;

            IF v_p1_score > v_p2_score THEN
                v_winner_id := v_match.player1_id;
                v_loser_id := v_match.player2_id;
            ELSIF v_p2_score > v_p1_score THEN
                v_winner_id := v_match.player2_id;
                v_loser_id := v_match.player1_id;
            ELSE
                -- Draw - flag as disputed (for simplicity in this bracket)
                UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
                RETURN NEW;
            END IF;

            -- Update match
            UPDATE matches SET status = 'verified', winner_id = v_winner_id WHERE id = NEW.match_id;

            -- Update GLOBAL Stats in profiles
            UPDATE profiles SET 
                total_goals_scored = COALESCE(total_goals_scored, 0) + v_p1_score,
                total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p2_score
            WHERE id = v_match.player1_id;

            UPDATE profiles SET 
                total_goals_scored = COALESCE(total_goals_scored, 0) + v_p2_score,
                total_goals_conceded = COALESCE(total_goals_conceded, 0) + v_p1_score
            WHERE id = v_match.player2_id;

            -- Update TOURNAMENT Stats for Player 1
            INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
            VALUES (v_match.tournament_id, v_match.player1_id, v_p1_score, v_p2_score, CASE WHEN v_winner_id = v_match.player1_id THEN 1 ELSE 0 END, 1)
            ON CONFLICT (tournament_id, user_id) 
            DO UPDATE SET 
                goals_scored = tournament_stats.goals_scored + v_p1_score,
                goals_conceded = tournament_stats.goals_conceded + v_p2_score,
                wins = tournament_stats.wins + (CASE WHEN v_winner_id = v_match.player1_id THEN 1 ELSE 0 END),
                matches_played = tournament_stats.matches_played + 1;

            -- Update TOURNAMENT Stats for Player 2
            INSERT INTO tournament_stats (tournament_id, user_id, goals_scored, goals_conceded, wins, matches_played)
            VALUES (v_match.tournament_id, v_match.player2_id, v_p2_score, v_p1_score, CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END, 1)
            ON CONFLICT (tournament_id, user_id) 
            DO UPDATE SET 
                goals_scored = tournament_stats.goals_scored + v_p2_score,
                goals_conceded = tournament_stats.goals_conceded + v_p1_score,
                wins = tournament_stats.wins + (CASE WHEN v_winner_id = v_match.player2_id THEN 1 ELSE 0 END),
                matches_played = tournament_stats.matches_played + 1;

            -- Advance the winner in the bracket
            DECLARE
                v_next_match_id UUID;
                v_position INT;
            BEGIN
                SELECT next_match_id, position INTO v_next_match_id, v_position 
                FROM brackets WHERE match_id = NEW.match_id;

                IF v_next_match_id IS NOT NULL THEN
                    -- If v_position is odd, winner becomes player1. If even, player2.
                    IF v_position % 2 = 1 THEN
                        UPDATE matches SET player1_id = v_winner_id WHERE id = v_next_match_id;
                    ELSE
                        UPDATE matches SET player2_id = v_winner_id WHERE id = v_next_match_id;
                    END IF;
                    
                    -- Run sweep to auto-resolve any empty branches this winner just entered
                    PERFORM sweep_bracket(v_match.tournament_id);
                END IF;
            END;
        ELSE
            -- Scores mismatch
            UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
        END IF;
    ELSE
        -- Only one submission so far
        UPDATE matches SET status = 'waiting_submission' WHERE id = NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$;
