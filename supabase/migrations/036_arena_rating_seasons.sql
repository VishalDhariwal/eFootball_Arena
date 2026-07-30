-- Migration: 036_arena_rating_seasons.sql
-- Description: Implement zero-sum Arena Rating formula with K-Factor scaling, goal bonuses, and monthly season resets.

-- ==========================================
-- 1. Create Season Archives Table
-- ==========================================
CREATE TABLE IF NOT EXISTS season_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_name TEXT NOT NULL,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    final_ar INT NOT NULL,
    global_rank INT NOT NULL,
    total_wins INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE season_archives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Season archives viewable by all" ON season_archives;
CREATE POLICY "Season archives viewable by all" ON season_archives FOR SELECT USING (true);

-- ==========================================
-- 2. Zero-Sum AR Exchange Function
-- ==========================================
CREATE OR REPLACE FUNCTION fn_calculate_ar_exchange(
    winner_ar INT,
    loser_ar INT,
    k_factor INT,
    goals_scored INT,
    goals_conceded INT
) RETURNS INT AS $$
DECLARE
    v_expected_score_winner FLOAT;
    v_base_exchange INT;
    v_goal_diff_bonus INT;
    v_total_exchange INT;
BEGIN
    -- 1. Expected Win Probability
    v_expected_score_winner := 1.0 / (1.0 + power(10.0, (loser_ar - winner_ar) / 400.0));
    
    -- 2. Base Exchange (Zero-Sum Elo)
    v_base_exchange := round(k_factor * (1.0 - v_expected_score_winner));
    
    -- 3. Goal Difference Bonus (min(max(scored - conceded, 0), 3))
    v_goal_diff_bonus := LEAST(GREATEST(goals_scored - goals_conceded, 0), 3);
    
    -- 4. Total Exchange
    v_total_exchange := v_base_exchange + v_goal_diff_bonus;
    
    -- Safety check to ensure it doesn't drop below 0 if somehow expected was 1 and GD was 0
    IF v_total_exchange < 0 THEN
        v_total_exchange := 0;
    END IF;

    RETURN v_total_exchange;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 3. Update Match Verification Trigger
-- ==========================================
CREATE OR REPLACE FUNCTION process_verified_match()
RETURNS TRIGGER AS $$
DECLARE
    v_loser_id UUID;
    v_winner_elo INT;
    v_loser_elo INT;
    v_new_winner_elo INT;
    v_new_loser_elo INT;
    v_k_factor INT := 32;
    v_total_wins INT;
    v_total_exchange INT;
    
    -- For K-Factor scaling
    v_round_name TEXT;
    
    -- For Goal Bonus
    v_winner_goals INT := 0;
    v_loser_goals INT := 0;
BEGIN
    -- Only run when status changes to 'verified'
    IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
        
        -- Determine loser
        IF NEW.winner_id = NEW.player1_id THEN
            v_loser_id := NEW.player2_id;
        ELSE
            v_loser_id := NEW.player1_id;
        END IF;

        -- Create Notifications
        IF NEW.winner_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, message) 
            VALUES (NEW.winner_id, 'match_won', 'Your match was verified. You won!');
        END IF;

        IF v_loser_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, message) 
            VALUES (v_loser_id, 'match_lost', 'Your match was verified. You lost.');
        END IF;

        -- Calculate AR Exchange if both players exist (not a BYE)
        IF NEW.winner_id IS NOT NULL AND v_loser_id IS NOT NULL THEN
            SELECT elo_rating INTO v_winner_elo FROM profiles WHERE id = NEW.winner_id;
            SELECT elo_rating INTO v_loser_elo FROM profiles WHERE id = v_loser_id;

            -- Default to 1000 if null
            v_winner_elo := COALESCE(v_winner_elo, 1000);
            v_loser_elo := COALESCE(v_loser_elo, 1000);

            -- Determine K-Factor based on Round
            IF NEW.round_id IS NOT NULL THEN
                SELECT lower(name) INTO v_round_name FROM rounds WHERE id = NEW.round_id;
                
                IF v_round_name LIKE '%final%' AND v_round_name NOT LIKE '%quarter%' AND v_round_name NOT LIKE '%semi%' THEN
                    v_k_factor := 80;
                ELSIF v_round_name LIKE '%semi%' THEN
                    v_k_factor := 64;
                ELSIF v_round_name LIKE '%quarter%' THEN
                    v_k_factor := 48;
                ELSIF v_round_name LIKE '%round of 16%' OR v_round_name LIKE '%r16%' THEN
                    v_k_factor := 40;
                ELSE
                    v_k_factor := 32; -- Default Ranked / Group Stages
                END IF;
            ELSE
                v_k_factor := 16; -- Friendlies / Unranked / No Round
            END IF;

            -- Try to get Goals from match_detailed_stats (falling back to 0 if not found)
            -- Winner Goals
            SELECT goals_scored INTO v_winner_goals 
            FROM match_detailed_stats 
            WHERE match_id = NEW.id AND player_id = NEW.winner_id 
            LIMIT 1;
            
            -- Loser Goals
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
            
            -- Floor rating at 0 to prevent negative ratings
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


-- ==========================================
-- 4. Season Reset RPC
-- ==========================================
CREATE OR REPLACE FUNCTION rpc_end_season(p_season_name TEXT)
RETURNS void AS $$
DECLARE
    v_player record;
    v_rank INT := 1;
BEGIN
    -- 1. Archive Top Players and Stats
    -- Fetch everyone ordered by ELO and archive them
    FOR v_player IN (
        SELECT p.id, p.elo_rating, ps.matches_played, COALESCE(
            (SELECT COUNT(*) FROM matches m WHERE m.winner_id = p.id AND m.status = 'verified'), 0
        ) as total_wins
        FROM profiles p
        LEFT JOIN player_statistics ps ON ps.player_id = p.id
        ORDER BY p.elo_rating DESC, ps.matches_played DESC
    )
    LOOP
        -- Only archive if they've played at least 1 match this season
        IF v_player.matches_played > 0 THEN
            INSERT INTO season_archives (season_name, player_id, final_ar, global_rank, total_wins)
            VALUES (p_season_name, v_player.id, v_player.elo_rating, v_rank, v_player.total_wins);
            
            v_rank := v_rank + 1;
        END IF;
    END LOOP;

    -- 2. Execute Soft Reset (Compression) for ALL players
    UPDATE profiles 
    SET elo_rating = ROUND((elo_rating + 1000) / 2.0);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 5. Global Leaderboard View
-- ==========================================
DROP VIEW IF EXISTS vw_global_leaderboard;
CREATE VIEW vw_global_leaderboard AS
SELECT 
    p.id as player_id,
    p.display_name,
    p.player_id as unique_player_id,
    p.elo_rating as arena_rating,
    COALESCE(ps.matches_played, 0) as total_matches,
    COALESCE((SELECT COUNT(*) FROM matches m WHERE m.winner_id = p.id AND m.status = 'verified'), 0) as total_wins,
    -- Determine if they were a previous champion
    EXISTS (
        SELECT 1 FROM season_archives sa 
        WHERE sa.player_id = p.id AND sa.global_rank = 1
    ) as is_previous_champion,
    (
        SELECT sa.season_name FROM season_archives sa 
        WHERE sa.player_id = p.id AND sa.global_rank = 1 
        ORDER BY sa.created_at DESC LIMIT 1
    ) as champion_season
FROM profiles p
LEFT JOIN player_statistics ps ON ps.player_id = p.id
WHERE COALESCE(ps.matches_played, 0) >= 1 -- Must have played at least 1 match to be on leaderboard
ORDER BY p.elo_rating DESC;
