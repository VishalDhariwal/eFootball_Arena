-- Migration: 038_hybrid_arena_rating.sql
-- Description: Refactored Hybrid Arena Rating System with robust idempotency, conservative config, and true tournament size calculations.

-- ==========================================
-- 1. Configuration Table & Ledger
-- ==========================================
CREATE TABLE IF NOT EXISTS tournament_bonus_config (
    team_count INT PRIMARY KEY,
    champion_bonus INT NOT NULL DEFAULT 0,
    runner_up_bonus INT NOT NULL DEFAULT 0,
    semi_finalist_bonus INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE tournament_bonus_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bonus config viewable by all" ON tournament_bonus_config;
CREATE POLICY "Bonus config viewable by all" ON tournament_bonus_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update bonus config" ON tournament_bonus_config;
CREATE POLICY "Admins can update bonus config" ON tournament_bonus_config FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);

-- Auto-refresh updated_at trigger
CREATE OR REPLACE FUNCTION update_tournament_bonus_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_tournament_bonus_config_updated_at ON tournament_bonus_config;
CREATE TRIGGER trg_tournament_bonus_config_updated_at
BEFORE UPDATE ON tournament_bonus_config
FOR EACH ROW
EXECUTE FUNCTION update_tournament_bonus_config_timestamp();

-- Seed highly conservative values to prevent inflation while rewarding champions
INSERT INTO tournament_bonus_config (team_count, champion_bonus, runner_up_bonus, semi_finalist_bonus) VALUES
(4, 10, 0, 0),
(8, 15, 5, 0),
(16, 20, 8, 3),
(32, 30, 12, 5),
(64, 40, 15, 8)
ON CONFLICT (team_count) DO UPDATE 
SET champion_bonus = EXCLUDED.champion_bonus,
    runner_up_bonus = EXCLUDED.runner_up_bonus,
    semi_finalist_bonus = EXCLUDED.semi_finalist_bonus;

-- ENUM for type-safe history
DO $$ BEGIN
    CREATE TYPE rating_change_type AS ENUM (
        'Match Result', 
        'Goal Difference Bonus', 
        'Goal Difference Penalty', 
        'Champion Bonus', 
        'Runner-up Bonus', 
        'Semi-finalist Bonus'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    change_type rating_change_type NOT NULL,
    elo_change INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(match_id, player_id, change_type) -- Strict Idempotency Lock
);

ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rating history viewable by all" ON rating_history;
CREATE POLICY "Rating history viewable by all" ON rating_history FOR SELECT USING (true);


-- ==========================================
-- 2. Update Match Verification Trigger
-- ==========================================
DROP FUNCTION IF EXISTS fn_calculate_ar_exchange(INT, INT, INT, INT, INT);

CREATE OR REPLACE FUNCTION process_verified_match()
RETURNS TRIGGER AS $$
DECLARE
    v_winner_elo INT;
    v_loser_elo INT;
    v_new_winner_elo INT;
    v_new_loser_elo INT;
    v_k_factor INT := 32;
    v_loser_id UUID;
    v_winner_goals INT := 0;
    v_loser_goals INT := 0;
    
    -- Math variables
    v_expected_score_winner FLOAT;
    v_base_exchange INT;
    v_goal_diff_bonus INT;

    -- Hybrid System Variables
    v_max_order_index INT;
    v_current_order_index INT;
    v_tourney_size INT;
    v_champ_bonus INT := 0;
    v_runner_bonus INT := 0;
    v_semi_bonus INT := 0;
    v_total_wins INT;
    v_inserted_val INT;
BEGIN
    IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
        
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
            
            v_new_winner_elo := v_winner_elo;
            v_new_loser_elo := v_loser_elo;

            -- 1. Determine True Bracket Size (robust against non-standard formats)
            IF NEW.tournament_id IS NOT NULL THEN
                SELECT max_players INTO v_tourney_size FROM tournaments WHERE id = NEW.tournament_id;
                
                -- Fallback to actual registration count if max_players is null or 0
                IF v_tourney_size IS NULL OR v_tourney_size = 0 THEN
                    SELECT COUNT(*) INTO v_tourney_size FROM registrations WHERE tournament_id = NEW.tournament_id AND registration_status = 'approved';
                END IF;

                -- Fetch Config for this true tournament size
                SELECT champion_bonus, runner_up_bonus, semi_finalist_bonus 
                INTO v_champ_bonus, v_runner_bonus, v_semi_bonus
                FROM tournament_bonus_config
                WHERE team_count >= COALESCE(v_tourney_size, 4)
                ORDER BY team_count ASC
                LIMIT 1;

                IF v_champ_bonus IS NULL THEN
                    SELECT champion_bonus, runner_up_bonus, semi_finalist_bonus 
                    INTO v_champ_bonus, v_runner_bonus, v_semi_bonus
                    FROM tournament_bonus_config
                    ORDER BY team_count DESC
                    LIMIT 1;
                END IF;
            END IF;

            -- 2. Determine Mathematical Stage & K-Factor
            IF NEW.tournament_id IS NOT NULL AND NEW.round_id IS NOT NULL THEN
                SELECT MAX(order_index) INTO v_max_order_index FROM rounds WHERE tournament_id = NEW.tournament_id;
                SELECT order_index INTO v_current_order_index FROM rounds WHERE id = NEW.round_id;
                
                -- Determine K-Factor mathematically
                IF v_current_order_index = v_max_order_index THEN
                    v_k_factor := 80; -- Final
                    IF NEW.winner_id IS NOT NULL THEN
                        UPDATE tournaments SET winner_id = NEW.winner_id WHERE id = NEW.tournament_id;
                    END IF;
                ELSIF v_current_order_index = v_max_order_index - 1 THEN
                    v_k_factor := 64; -- Semi-Final
                ELSIF v_current_order_index = v_max_order_index - 2 THEN
                    v_k_factor := 48; -- Quarter-Final
                ELSIF v_current_order_index = v_max_order_index - 3 THEN
                    v_k_factor := 40; -- Round of 16
                ELSE
                    v_k_factor := 32; -- Early rounds / League
                END IF;
            ELSE
                v_k_factor := 16; -- Friendly / No Tournament
            END IF;

            -- 3. Calculate Base Exchange & Goals
            SELECT goals_scored INTO v_winner_goals FROM match_detailed_stats WHERE match_id = NEW.id AND player_id = NEW.winner_id LIMIT 1;
            SELECT goals_scored INTO v_loser_goals FROM match_detailed_stats WHERE match_id = NEW.id AND player_id = v_loser_id LIMIT 1;
            
            v_winner_goals := COALESCE(v_winner_goals, 0);
            v_loser_goals := COALESCE(v_loser_goals, 0);

            v_expected_score_winner := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
            v_base_exchange := round(v_k_factor * (1.0 - v_expected_score_winner));
            
            -- Reduced GD Bonus cap to 2 to discourage running up the score unnecessarily
            v_goal_diff_bonus := LEAST(GREATEST(v_winner_goals - v_loser_goals, 0), 2);

            -- ========================================================================
            -- 4. Idempotent Processing (STRICT GUARANTEES AGAINST DUPLICATES)
            -- ========================================================================
            
            -- A. Match Result
            INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
            VALUES (NEW.winner_id, NEW.id, NEW.tournament_id, 'Match Result', v_base_exchange)
            ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
            IF FOUND THEN v_new_winner_elo := v_new_winner_elo + v_inserted_val; END IF;
            
            INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
            VALUES (v_loser_id, NEW.id, NEW.tournament_id, 'Match Result', -v_base_exchange)
            ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
            IF FOUND THEN v_new_loser_elo := v_new_loser_elo + v_inserted_val; END IF;

            -- B. Goal Difference Bonus
            IF v_goal_diff_bonus > 0 THEN
                INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
                VALUES (NEW.winner_id, NEW.id, NEW.tournament_id, 'Goal Difference Bonus', v_goal_diff_bonus)
                ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
                IF FOUND THEN v_new_winner_elo := v_new_winner_elo + v_inserted_val; END IF;

                INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
                VALUES (v_loser_id, NEW.id, NEW.tournament_id, 'Goal Difference Penalty', -v_goal_diff_bonus)
                ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
                IF FOUND THEN v_new_loser_elo := v_new_loser_elo + v_inserted_val; END IF;
            END IF;

            -- C. Tournament Non-Zero-Sum Bonuses
            IF NEW.tournament_id IS NOT NULL AND v_max_order_index IS NOT NULL THEN
                
                -- FINAL STAGE
                IF v_current_order_index = v_max_order_index THEN
                    -- Champion
                    IF v_champ_bonus > 0 THEN
                        INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
                        VALUES (NEW.winner_id, NEW.id, NEW.tournament_id, 'Champion Bonus', v_champ_bonus)
                        ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
                        IF FOUND THEN v_new_winner_elo := v_new_winner_elo + v_inserted_val; END IF;
                    END IF;
                    
                    -- Runner-up
                    IF v_runner_bonus > 0 THEN
                        INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
                        VALUES (v_loser_id, NEW.id, NEW.tournament_id, 'Runner-up Bonus', v_runner_bonus)
                        ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
                        IF FOUND THEN v_new_loser_elo := v_new_loser_elo + v_inserted_val; END IF;
                    END IF;
                
                -- SEMI-FINAL STAGE
                ELSIF v_current_order_index = v_max_order_index - 1 THEN
                    -- Loser of Semi-Final gets SF Bonus
                    IF v_semi_bonus > 0 THEN
                        INSERT INTO rating_history (player_id, match_id, tournament_id, change_type, elo_change)
                        VALUES (v_loser_id, NEW.id, NEW.tournament_id, 'Semi-finalist Bonus', v_semi_bonus)
                        ON CONFLICT (match_id, player_id, change_type) DO NOTHING RETURNING elo_change INTO v_inserted_val;
                        IF FOUND THEN v_new_loser_elo := v_new_loser_elo + v_inserted_val; END IF;
                    END IF;
                END IF;
            END IF;

            -- Safety Floor
            IF v_new_loser_elo < 0 THEN
                v_new_loser_elo := 0;
            END IF;

            -- 5. Execute Final Profile Updates
            UPDATE profiles SET elo_rating = v_new_winner_elo WHERE id = NEW.winner_id;
            UPDATE profiles SET elo_rating = v_new_loser_elo WHERE id = v_loser_id;
        END IF;

        -- Check Achievements for Winner
        IF NEW.winner_id IS NOT NULL THEN
            SELECT count(*) INTO v_total_wins FROM matches WHERE winner_id = NEW.winner_id AND status = 'verified';
            IF v_total_wins = 1 THEN
                INSERT INTO user_achievements (user_id, achievement_id)
                SELECT NEW.winner_id, id FROM achievements WHERE name = 'First Blood' ON CONFLICT DO NOTHING;
            END IF;
            IF v_total_wins = 10 THEN
                INSERT INTO user_achievements (user_id, achievement_id)
                SELECT NEW.winner_id, id FROM achievements WHERE name = 'Veteran' ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. Update Season Reset RPC (25% Soft Reset)
-- ==========================================
CREATE OR REPLACE FUNCTION rpc_end_season(p_season_name TEXT)
RETURNS void AS $$
DECLARE
    v_player record;
    v_rank INT := 1;
BEGIN
    -- 1. Archive Top Players
    FOR v_player IN (
        SELECT p.id, p.elo_rating, ps.matches_played, COALESCE(
            (SELECT COUNT(*) FROM matches m WHERE m.winner_id = p.id AND m.status = 'verified'), 0
        ) as total_wins
        FROM profiles p
        LEFT JOIN player_statistics ps ON ps.player_id = p.id
        ORDER BY p.elo_rating DESC, ps.matches_played DESC
    ) LOOP
        IF v_rank <= 3 THEN
            INSERT INTO season_archives (season_name, player_id, final_ar, global_rank, total_wins)
            VALUES (p_season_name, v_player.id, v_player.elo_rating, v_rank, v_player.total_wins);
        END IF;
        v_rank := v_rank + 1;
    END LOOP;

    -- 2. Hybrid System Soft Reset (25% closer to 1000)
    UPDATE profiles SET elo_rating = ROUND(1000 + (elo_rating - 1000) * 0.75);

    -- 3. Refresh Caches / Materialized Views to ensure UI is instantly consistent
    -- Note: vw_global_leaderboard is a standard VIEW so it automatically reflects the updated profiles table instantly.
    -- We only need to manually refresh Materialized Views here.
    REFRESH MATERIALIZED VIEW CONCURRENTLY global_stat_distributions;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
