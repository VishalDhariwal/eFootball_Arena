-- Migration: 035_game_rating_algorithm.sql
-- Description: Implement game-like 50-99 rating scale, realistic caps, weighted overalls, and prioritized play styles.

-- ==========================================
-- 1. Alter existing table to add rating_confidence
-- ==========================================
ALTER TABLE player_attribute_ratings
ADD COLUMN IF NOT EXISTS rating_confidence TEXT DEFAULT 'Low';


-- ==========================================
-- 2. Create Configuration Table for Caps and Weights
-- ==========================================
CREATE TABLE IF NOT EXISTS game_rating_config (
    id INT PRIMARY KEY CHECK (id = 1),
    
    -- Caps for 50 (Min) and 99 (Max) ratings
    cap_goals_min NUMERIC DEFAULT 0.0,
    cap_goals_max NUMERIC DEFAULT 4.0,
    cap_shots_min NUMERIC DEFAULT 2.0,
    cap_shots_max NUMERIC DEFAULT 15.0,
    cap_sot_min NUMERIC DEFAULT 0.0,
    cap_sot_max NUMERIC DEFAULT 8.0,
    cap_shot_acc_min NUMERIC DEFAULT 30.0,
    cap_shot_acc_max NUMERIC DEFAULT 85.0,
    
    cap_passes_min NUMERIC DEFAULT 40.0,
    cap_passes_max NUMERIC DEFAULT 150.0,
    cap_pass_acc_min NUMERIC DEFAULT 50.0,
    cap_pass_acc_max NUMERIC DEFAULT 95.0,
    
    cap_poss_min NUMERIC DEFAULT 35.0,
    cap_poss_max NUMERIC DEFAULT 65.0,
    
    cap_tackles_min NUMERIC DEFAULT 1.0,
    cap_tackles_max NUMERIC DEFAULT 12.0,
    cap_interceptions_min NUMERIC DEFAULT 0.0,
    cap_interceptions_max NUMERIC DEFAULT 10.0,
    cap_saves_min NUMERIC DEFAULT 0.0,
    cap_saves_max NUMERIC DEFAULT 6.0,
    
    cap_fouls_min NUMERIC DEFAULT 0.0,
    cap_fouls_max NUMERIC DEFAULT 5.0,
    
    -- Category Weights for Overall Rating
    weight_shooting NUMERIC DEFAULT 0.20,
    weight_passing NUMERIC DEFAULT 0.20,
    weight_possession NUMERIC DEFAULT 0.15,
    weight_defending NUMERIC DEFAULT 0.20,
    weight_finishing NUMERIC DEFAULT 0.20,
    weight_discipline NUMERIC DEFAULT 0.05
);

-- Insert the singleton configuration row
INSERT INTO game_rating_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Enable RLS for public reading
ALTER TABLE game_rating_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Config viewable by all" ON game_rating_config;
CREATE POLICY "Config viewable by all" ON game_rating_config FOR SELECT USING (true);


-- ==========================================
-- 3. The 50-99 Game Curve Math Function
-- ==========================================
CREATE OR REPLACE FUNCTION fn_game_curve_score(val numeric, min_val numeric, max_val numeric, inverse boolean DEFAULT false)
RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    normalized numeric;
    score numeric;
BEGIN
    IF max_val = min_val THEN
        IF max_val = 0 THEN max_val := 1; ELSE min_val := 0; END IF;
    END IF;
    
    -- Cap the value within min and max boundaries
    val := GREATEST(min_val, LEAST(val, max_val));
    
    -- Normalize between 0.0 and 1.0
    normalized := (val - min_val) / (max_val - min_val);
    
    IF inverse THEN 
        normalized := 1.0 - normalized; 
    END IF;
    
    -- Map 0.0-1.0 to 50-99 game curve
    score := 50 + (normalized * 49);
    
    RETURN GREATEST(50, LEAST(99, ROUND(score)));
END;
$$;


-- ==========================================
-- 4. Rewrite RPC to use Config, Weights, and Priority Play Styles
-- ==========================================
CREATE OR REPLACE FUNCTION rpc_refresh_all_player_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    conf RECORD;
BEGIN
    -- Fetch the singleton config
    SELECT * INTO conf FROM game_rating_config WHERE id = 1;
    IF NOT FOUND THEN RETURN; END IF;

    -- 1. Calculate and update base attribute ratings using realistic caps
    INSERT INTO player_attribute_ratings (
        player_id, shooting_score, passing_score, possession_score, 
        defending_score, finishing_score, discipline_score, overall_rating, play_style, updated_at
    )
    SELECT 
        ps.player_id,
        -- SHOOTING
        ROUND(
            (fn_game_curve_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), conf.cap_goals_min, conf.cap_goals_max) * 0.4) +
            (fn_game_curve_score(ps.total_shots::numeric / GREATEST(ps.matches_played, 1), conf.cap_shots_min, conf.cap_shots_max) * 0.2) +
            (fn_game_curve_score(ps.total_shots_on_target::numeric / GREATEST(ps.matches_played, 1), conf.cap_sot_min, conf.cap_sot_max) * 0.2) +
            (fn_game_curve_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, conf.cap_shot_acc_min, conf.cap_shot_acc_max) * 0.2)
        ) as shooting_score,
        -- PASSING
        ROUND(
            (fn_game_curve_score(CASE WHEN ps.total_passes > 0 THEN (ps.total_successful_passes::numeric / ps.total_passes) * 100 ELSE 0 END, conf.cap_pass_acc_min, conf.cap_pass_acc_max) * 0.6) +
            (fn_game_curve_score(ps.total_passes::numeric / GREATEST(ps.matches_played, 1), conf.cap_passes_min, conf.cap_passes_max) * 0.4)
        ) as passing_score,
        -- POSSESSION
        fn_game_curve_score(ps.total_possession::numeric / GREATEST(ps.matches_played, 1), conf.cap_poss_min, conf.cap_poss_max) as possession_score,
        -- DEFENDING
        ROUND(
            (fn_game_curve_score(ps.total_tackles::numeric / GREATEST(ps.matches_played, 1), conf.cap_tackles_min, conf.cap_tackles_max) * 0.4) +
            (fn_game_curve_score(ps.total_interceptions::numeric / GREATEST(ps.matches_played, 1), conf.cap_interceptions_min, conf.cap_interceptions_max) * 0.4) +
            (fn_game_curve_score(ps.total_saves::numeric / GREATEST(ps.matches_played, 1), conf.cap_saves_min, conf.cap_saves_max) * 0.2)
        ) as defending_score,
        -- FINISHING
        ROUND(
            (fn_game_curve_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), conf.cap_goals_min, conf.cap_goals_max) * 0.5) +
            (fn_game_curve_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, conf.cap_shot_acc_min, conf.cap_shot_acc_max) * 0.5)
        ) as finishing_score,
        -- DISCIPLINE (inverted)
        fn_game_curve_score(ps.total_fouls::numeric / GREATEST(ps.matches_played, 1), conf.cap_fouls_min, conf.cap_fouls_max, true) as discipline_score,
        -- OVERALL (dummy for now, calculated properly below)
        50 as overall_rating,
        'Balanced Player' as play_style,
        NOW() as updated_at
    FROM player_statistics ps
    WHERE ps.matches_played > 0
    ON CONFLICT (player_id) DO UPDATE SET
        shooting_score = EXCLUDED.shooting_score,
        passing_score = EXCLUDED.passing_score,
        possession_score = EXCLUDED.possession_score,
        defending_score = EXCLUDED.defending_score,
        finishing_score = EXCLUDED.finishing_score,
        discipline_score = EXCLUDED.discipline_score,
        updated_at = EXCLUDED.updated_at;

    -- 2. Update Overall (Weighted) and Playstyle (Prioritized Combinations)
    UPDATE player_attribute_ratings par
    SET 
        overall_rating = ROUND(
            (par.shooting_score * conf.weight_shooting) + 
            (par.passing_score * conf.weight_passing) + 
            (par.possession_score * conf.weight_possession) + 
            (par.defending_score * conf.weight_defending) + 
            (par.finishing_score * conf.weight_finishing) + 
            (par.discipline_score * conf.weight_discipline)
        ),
        rating_confidence = CASE 
            WHEN ps.matches_played >= 15 THEN 'High'
            WHEN ps.matches_played >= 5 THEN 'Medium'
            ELSE 'Low'
        END,
        play_style = CASE
            -- Tier 1: Exceptional Archetypes
            WHEN par.shooting_score > 85 AND par.passing_score > 85 AND par.defending_score > 85 THEN 'Complete Dominator'
            WHEN par.passing_score > 85 AND par.possession_score > 85 THEN 'Tiki-Taka Master'
            WHEN par.finishing_score > 88 AND par.shooting_score > 85 THEN 'Direct Attacker'
            
            -- Tier 2: Specific Tactical Roles
            WHEN par.defending_score > 80 AND par.passing_score > 82 THEN 'Possession Heavy'
            WHEN par.shooting_score > 80 AND par.possession_score < 60 THEN 'Counter-Attack Specialist'
            WHEN par.defending_score > 85 AND par.discipline_score > 80 THEN 'Catenaccio'
            WHEN par.defending_score > 85 AND par.discipline_score <= 60 THEN 'Gegenpresser'
            WHEN par.passing_score > 80 AND par.shooting_score > 80 THEN 'Creative Engine'
            
            -- Tier 3: Basic Fallbacks
            WHEN par.shooting_score >= GREATEST(par.passing_score, par.possession_score, par.defending_score) THEN 'Clinical Finisher'
            WHEN par.passing_score >= GREATEST(par.shooting_score, par.possession_score, par.defending_score) THEN 'Playmaker'
            WHEN par.possession_score >= GREATEST(par.shooting_score, par.passing_score, par.defending_score) THEN 'Possession Specialist'
            WHEN par.defending_score >= GREATEST(par.shooting_score, par.passing_score, par.possession_score) THEN 'Defensive Wall'
            ELSE 'Balanced Player'
        END
    FROM player_statistics ps
    WHERE par.player_id = ps.player_id;

END;
$$;

-- ==========================================
-- 5. Execute Initial Population
-- ==========================================
-- Run the function immediately to calculate the confidence and ratings for existing players
SELECT rpc_refresh_all_player_ratings();
