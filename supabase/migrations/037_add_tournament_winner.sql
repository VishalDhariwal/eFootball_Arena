-- Migration: 037_add_tournament_winner.sql
-- Description: Adds winner_id to tournaments, backfills existing ones, and updates process_verified_match.

-- 1. Add winner_id column to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id);

-- 2. Backfill existing completed tournaments by finding the winner of the Final match
DO $$
DECLARE
    v_t RECORD;
    v_winner UUID;
BEGIN
    FOR v_t IN (SELECT id FROM tournaments WHERE status = 'completed') LOOP
        SELECT m.winner_id INTO v_winner
        FROM matches m
        JOIN rounds r ON m.round_id = r.id
        WHERE m.tournament_id = v_t.id
          AND LOWER(r.name) = 'final'
          AND m.status = 'verified'
          AND m.winner_id IS NOT NULL
        LIMIT 1;

        IF v_winner IS NOT NULL THEN
            UPDATE tournaments SET winner_id = v_winner WHERE id = v_t.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Update Trigger Function to auto-assign tournament winner
CREATE OR REPLACE FUNCTION process_verified_match()
RETURNS TRIGGER AS $$
DECLARE
    v_winner_elo INT;
    v_loser_elo INT;
    v_new_winner_elo INT;
    v_new_loser_elo INT;
    v_total_exchange INT;
    v_k_factor INT := 32;
    v_total_wins INT;
    v_loser_id UUID;
    v_round_name TEXT;
    v_winner_goals INT := 0;
    v_loser_goals INT := 0;
BEGIN
    IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
        -- Only calculate ELO if both players are present
        IF NEW.player1_id IS NOT NULL AND NEW.player2_id IS NOT NULL THEN
            
            IF NEW.winner_id = NEW.player1_id THEN
                v_loser_id := NEW.player2_id;
            ELSE
                v_loser_id := NEW.player1_id;
            END IF;

            SELECT elo_rating INTO v_winner_elo FROM profiles WHERE id = NEW.winner_id;
            SELECT elo_rating INTO v_loser_elo FROM profiles WHERE id = v_loser_id;

            v_winner_elo := COALESCE(v_winner_elo, 1000);
            v_loser_elo := COALESCE(v_loser_elo, 1000);

            -- Determine Scale based on Round
            IF NEW.round_id IS NOT NULL THEN
                SELECT LOWER(name) INTO v_round_name FROM rounds WHERE id = NEW.round_id;
                
                IF v_round_name LIKE '%final%' AND v_round_name NOT LIKE '%quarter%' AND v_round_name NOT LIKE '%semi%' THEN
                    v_k_factor := 80;
                    
                    -- Since this is the Final, mark the tournament winner!
                    IF NEW.winner_id IS NOT NULL THEN
                        UPDATE tournaments SET winner_id = NEW.winner_id WHERE id = NEW.tournament_id;
                    END IF;
                    
                ELSIF v_round_name LIKE '%semi final%' OR v_round_name LIKE '%semi-final%' OR v_round_name LIKE '%sf%' THEN
                    v_k_factor := 64;
                ELSIF v_round_name LIKE '%quarter final%' OR v_round_name LIKE '%quarter-final%' OR v_round_name LIKE '%qf%' THEN
                    v_k_factor := 48;
                ELSIF v_round_name LIKE '%round of 16%' OR v_round_name LIKE '%r16%' THEN
                    v_k_factor := 40;
                ELSE
                    v_k_factor := 32;
                END IF;
            ELSE
                v_k_factor := 16;
            END IF;

            -- Try to get Goals
            SELECT goals_scored INTO v_winner_goals 
            FROM match_detailed_stats 
            WHERE match_id = NEW.id AND player_id = NEW.winner_id 
            LIMIT 1;
            
            SELECT goals_scored INTO v_loser_goals 
            FROM match_detailed_stats 
            WHERE match_id = NEW.id AND player_id = v_loser_id 
            LIMIT 1;
            
            v_winner_goals := COALESCE(v_winner_goals, 0);
            v_loser_goals := COALESCE(v_loser_goals, 0);

            -- Execute Zero-Sum Calculation
            v_total_exchange := fn_calculate_ar_exchange(v_winner_elo, v_loser_elo, v_k_factor, v_winner_goals, v_loser_goals);

            v_new_winner_elo := v_winner_elo + v_total_exchange;
            v_new_loser_elo := v_loser_elo - v_total_exchange;
            
            IF v_new_loser_elo < 0 THEN
                v_new_loser_elo := 0;
            END IF;

            -- Update Profiles
            UPDATE profiles SET elo_rating = v_new_winner_elo WHERE id = NEW.winner_id;
            UPDATE profiles SET elo_rating = v_new_loser_elo WHERE id = v_loser_id;
        END IF;

        -- Check Achievements for Winner
        IF NEW.winner_id IS NOT NULL THEN
            SELECT count(*) INTO v_total_wins FROM matches WHERE winner_id = NEW.winner_id AND status = 'verified';
            
            IF v_total_wins = 1 THEN
                INSERT INTO user_achievements (user_id, achievement_id)
                SELECT NEW.winner_id, id FROM achievements WHERE name = 'First Blood'
                ON CONFLICT DO NOTHING;
            END IF;

            IF v_total_wins = 10 THEN
                INSERT INTO user_achievements (user_id, achievement_id)
                SELECT NEW.winner_id, id FROM achievements WHERE name = 'Veteran'
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
