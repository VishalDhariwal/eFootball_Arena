-- Migration: 034_scalable_player_stats.sql
-- Description: Implement scalable precomputed player statistics architecture.

-- ==========================================
-- 1. Create Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS player_statistics (
    player_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    matches_played INT DEFAULT 0,
    total_goals INT DEFAULT 0,
    total_shots INT DEFAULT 0,
    total_shots_on_target INT DEFAULT 0,
    total_passes INT DEFAULT 0,
    total_successful_passes INT DEFAULT 0,
    total_possession INT DEFAULT 0,
    total_tackles INT DEFAULT 0,
    total_interceptions INT DEFAULT 0,
    total_saves INT DEFAULT 0,
    total_fouls INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for public reading
ALTER TABLE player_statistics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Player stats viewable by all" ON player_statistics;
CREATE POLICY "Player stats viewable by all" ON player_statistics FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS player_attribute_ratings (
    player_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shooting_score INT DEFAULT 50,
    passing_score INT DEFAULT 50,
    possession_score INT DEFAULT 50,
    defending_score INT DEFAULT 50,
    finishing_score INT DEFAULT 50,
    discipline_score INT DEFAULT 50,
    overall_rating INT DEFAULT 50,
    play_style TEXT DEFAULT 'Balanced Player',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for public reading
ALTER TABLE player_attribute_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Player attribute ratings viewable by all" ON player_attribute_ratings;
CREATE POLICY "Player attribute ratings viewable by all" ON player_attribute_ratings FOR SELECT USING (true);


-- ==========================================
-- 2. Trigger: Maintain Running Totals (Real-time O(1))
-- ==========================================
-- Instead of a complex delta logic that handles updates/deletes with old/new rows,
-- we'll just re-sum for the specific player involved. For a single player, 
-- aggregating their matches is extremely fast even with 5000 matches.
-- This ensures the player_statistics table is perfectly accurate instantly.

CREATE OR REPLACE FUNCTION trg_update_player_statistics()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_player_id UUID;
BEGIN
    -- Determine the player_id based on operation
    IF TG_OP = 'DELETE' THEN
        v_player_id := OLD.player_id;
    ELSE
        v_player_id := NEW.player_id;
    END IF;

    -- Upsert the recalculated sums for this specific player
    INSERT INTO player_statistics (
        player_id, matches_played, total_goals, total_shots, total_shots_on_target,
        total_passes, total_successful_passes, total_possession, total_tackles,
        total_interceptions, total_saves, total_fouls, updated_at
    )
    SELECT 
        v_player_id,
        COUNT(*),
        COALESCE(SUM(goals_scored), 0),
        COALESCE(SUM(shots), 0),
        COALESCE(SUM(shots_on_target), 0),
        COALESCE(SUM(passes), 0),
        COALESCE(SUM(ROUND((passes * pass_accuracy) / 100.0)), 0),
        COALESCE(SUM(possession), 0),
        COALESCE(SUM(tackles), 0),
        COALESCE(SUM(interceptions), 0),
        COALESCE(SUM(saves), 0),
        COALESCE(SUM(fouls), 0),
        NOW()
    FROM match_detailed_stats
    WHERE player_id = v_player_id
    ON CONFLICT (player_id) DO UPDATE SET
        matches_played = EXCLUDED.matches_played,
        total_goals = EXCLUDED.total_goals,
        total_shots = EXCLUDED.total_shots,
        total_shots_on_target = EXCLUDED.total_shots_on_target,
        total_passes = EXCLUDED.total_passes,
        total_successful_passes = EXCLUDED.total_successful_passes,
        total_possession = EXCLUDED.total_possession,
        total_tackles = EXCLUDED.total_tackles,
        total_interceptions = EXCLUDED.total_interceptions,
        total_saves = EXCLUDED.total_saves,
        total_fouls = EXCLUDED.total_fouls,
        updated_at = NOW();

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_match_detailed_stats_change ON match_detailed_stats;
CREATE TRIGGER on_match_detailed_stats_change
AFTER INSERT OR UPDATE OR DELETE ON match_detailed_stats
FOR EACH ROW EXECUTE FUNCTION trg_update_player_statistics();


-- ==========================================
-- 3. Materialized View: Global Stat Distributions
-- ==========================================
-- This view caches the absolute lowest and highest per-game averages
-- across the entire platform.

CREATE MATERIALIZED VIEW IF NOT EXISTS global_stat_distributions AS
WITH per_game AS (
    SELECT 
        player_id,
        GREATEST(matches_played, 1) as m,
        total_goals::numeric / GREATEST(matches_played, 1) as goals_per_game,
        total_shots::numeric / GREATEST(matches_played, 1) as shots_per_game,
        total_shots_on_target::numeric / GREATEST(matches_played, 1) as shots_on_target_per_game,
        total_passes::numeric / GREATEST(matches_played, 1) as passes_per_game,
        CASE WHEN total_passes > 0 THEN total_successful_passes::numeric / total_passes * 100 ELSE 0 END as pass_accuracy,
        CASE WHEN total_shots > 0 THEN total_shots_on_target::numeric / total_shots * 100 ELSE 0 END as shot_accuracy,
        total_possession::numeric / GREATEST(matches_played, 1) as avg_possession,
        total_tackles::numeric / GREATEST(matches_played, 1) as tackles_per_game,
        total_interceptions::numeric / GREATEST(matches_played, 1) as interceptions_per_game,
        total_saves::numeric / GREATEST(matches_played, 1) as saves_per_game,
        total_fouls::numeric / GREATEST(matches_played, 1) as fouls_per_game
    FROM player_statistics
    WHERE matches_played > 0
)
SELECT 
    1 as id, -- Single row for easy querying
    COALESCE(MIN(goals_per_game), 0) as min_goals, COALESCE(MAX(goals_per_game), 1) as max_goals,
    COALESCE(MIN(shots_per_game), 0) as min_shots, COALESCE(MAX(shots_per_game), 1) as max_shots,
    COALESCE(MIN(shots_on_target_per_game), 0) as min_sot, COALESCE(MAX(shots_on_target_per_game), 1) as max_sot,
    COALESCE(MIN(passes_per_game), 0) as min_passes, COALESCE(MAX(passes_per_game), 1) as max_passes,
    LEAST(COALESCE(MIN(pass_accuracy), 0), 20) as min_pass_acc, GREATEST(COALESCE(MAX(pass_accuracy), 1), 80) as max_pass_acc,
    LEAST(COALESCE(MIN(shot_accuracy), 0), 20) as min_shot_acc, GREATEST(COALESCE(MAX(shot_accuracy), 1), 80) as max_shot_acc,
    LEAST(COALESCE(MIN(avg_possession), 0), 20) as min_poss, GREATEST(COALESCE(MAX(avg_possession), 1), 80) as max_poss,
    COALESCE(MIN(tackles_per_game), 0) as min_tackles, COALESCE(MAX(tackles_per_game), 1) as max_tackles,
    COALESCE(MIN(interceptions_per_game), 0) as min_interceptions, COALESCE(MAX(interceptions_per_game), 1) as max_interceptions,
    COALESCE(MIN(saves_per_game), 0) as min_saves, COALESCE(MAX(saves_per_game), 1) as max_saves,
    COALESCE(MIN(fouls_per_game), 0) as min_fouls, COALESCE(MAX(fouls_per_game), 1) as max_fouls
FROM per_game;

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_stat_distributions_id ON global_stat_distributions(id);

-- Helper function to safely calculate a 0-100 normalized score inside Postgres
CREATE OR REPLACE FUNCTION fn_normalize_score(val numeric, min_val numeric, max_val numeric, inverse boolean DEFAULT false)
RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    score numeric;
BEGIN
    IF max_val = min_val THEN
        IF max_val = 0 THEN max_val := 1; ELSE min_val := 0; END IF;
    END IF;
    
    score := ((val - min_val) / (max_val - min_val)) * 100;
    IF inverse THEN score := 100 - score; END IF;
    
    RETURN GREATEST(0, LEAST(100, ROUND(score)));
END;
$$;


-- ==========================================
-- 4. Scheduled RPC: Recalculate All Ratings
-- ==========================================
-- This function refreshes the global curve, then calculates and stores
-- the final 0-100 scores for every player.

CREATE OR REPLACE FUNCTION rpc_refresh_all_player_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dist RECORD;
BEGIN
    -- 1. Refresh global distributions concurrently (requires unique index)
    REFRESH MATERIALIZED VIEW CONCURRENTLY global_stat_distributions;

    -- 2. Fetch the new global curve
    SELECT * INTO dist FROM global_stat_distributions WHERE id = 1;
    IF NOT FOUND THEN RETURN; END IF;

    -- 3. Calculate and update ratings for all players
    INSERT INTO player_attribute_ratings (
        player_id, shooting_score, passing_score, possession_score, 
        defending_score, finishing_score, discipline_score, overall_rating, play_style, updated_at
    )
    SELECT 
        ps.player_id,
        -- SHOOTING
        ROUND(
            (fn_normalize_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), dist.min_goals, dist.max_goals) * 0.4) +
            (fn_normalize_score(ps.total_shots::numeric / GREATEST(ps.matches_played, 1), dist.min_shots, dist.max_shots) * 0.2) +
            (fn_normalize_score(ps.total_shots_on_target::numeric / GREATEST(ps.matches_played, 1), dist.min_sot, dist.max_sot) * 0.2) +
            (fn_normalize_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, dist.min_shot_acc, dist.max_shot_acc) * 0.2)
        ) as shooting_score,
        -- PASSING
        ROUND(
            (fn_normalize_score(CASE WHEN ps.total_passes > 0 THEN (ps.total_successful_passes::numeric / ps.total_passes) * 100 ELSE 0 END, dist.min_pass_acc, dist.max_pass_acc) * 0.6) +
            (fn_normalize_score(ps.total_passes::numeric / GREATEST(ps.matches_played, 1), dist.min_passes, dist.max_passes) * 0.4)
        ) as passing_score,
        -- POSSESSION
        fn_normalize_score(ps.total_possession::numeric / GREATEST(ps.matches_played, 1), dist.min_poss, dist.max_poss) as possession_score,
        -- DEFENDING
        ROUND(
            (fn_normalize_score(ps.total_tackles::numeric / GREATEST(ps.matches_played, 1), dist.min_tackles, dist.max_tackles) * 0.4) +
            (fn_normalize_score(ps.total_interceptions::numeric / GREATEST(ps.matches_played, 1), dist.min_interceptions, dist.max_interceptions) * 0.4) +
            (fn_normalize_score(ps.total_saves::numeric / GREATEST(ps.matches_played, 1), dist.min_saves, dist.max_saves) * 0.2)
        ) as defending_score,
        -- FINISHING
        ROUND(
            (fn_normalize_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), dist.min_goals, dist.max_goals) * 0.5) +
            (fn_normalize_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, dist.min_shot_acc, dist.max_shot_acc) * 0.5)
        ) as finishing_score,
        -- DISCIPLINE (inverted)
        fn_normalize_score(ps.total_fouls::numeric / GREATEST(ps.matches_played, 1), dist.min_fouls, dist.max_fouls, true) as discipline_score,
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

    -- Update Overall and Playstyle after base scores are set
    UPDATE player_attribute_ratings
    SET 
        overall_rating = ROUND((shooting_score + passing_score + possession_score + defending_score + finishing_score + discipline_score) / 6.0),
        play_style = CASE
            WHEN shooting_score >= GREATEST(passing_score, possession_score, defending_score) OR finishing_score >= GREATEST(passing_score, possession_score, defending_score) THEN 'Clinical Finisher'
            WHEN passing_score >= GREATEST(shooting_score, possession_score, defending_score) THEN 'Playmaker'
            WHEN possession_score >= GREATEST(shooting_score, passing_score, defending_score) THEN 'Possession Specialist'
            WHEN defending_score >= GREATEST(shooting_score, passing_score, possession_score) THEN 'Defensive Wall'
            WHEN shooting_score > 75 AND defending_score > 75 THEN 'Box-to-Box'
            ELSE 'Balanced Player'
        END;

END;
$$;


-- ==========================================
-- 5. Pg_Cron Scheduling (Optional)
-- ==========================================
-- Schedule the RPC to run every 15 minutes.
-- (Will only execute if pg_cron extension is enabled on the instance)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Safely schedule job
        PERFORM cron.schedule('refresh_player_ratings', '*/15 * * * *', 'SELECT rpc_refresh_all_player_ratings()');
    END IF;
EXCEPTION WHEN OTHERS THEN 
    -- Ignore error if cron schema doesn't exist
END $$;


-- ==========================================
-- 6. Initial Data Seeding
-- ==========================================
-- Build stats for players who already have matches
INSERT INTO player_statistics (
    player_id, matches_played, total_goals, total_shots, total_shots_on_target,
    total_passes, total_successful_passes, total_possession, total_tackles,
    total_interceptions, total_saves, total_fouls, updated_at
)
SELECT 
    player_id,
    COUNT(*),
    COALESCE(SUM(goals_scored), 0),
    COALESCE(SUM(shots), 0),
    COALESCE(SUM(shots_on_target), 0),
    COALESCE(SUM(passes), 0),
    COALESCE(SUM(ROUND((passes * pass_accuracy) / 100.0)), 0),
    COALESCE(SUM(possession), 0),
    COALESCE(SUM(tackles), 0),
    COALESCE(SUM(interceptions), 0),
    COALESCE(SUM(saves), 0),
    COALESCE(SUM(fouls), 0),
    NOW()
FROM match_detailed_stats
GROUP BY player_id
ON CONFLICT (player_id) DO NOTHING;

-- Run the refresh immediately to populate ratings for existing players
SELECT rpc_refresh_all_player_ratings();
