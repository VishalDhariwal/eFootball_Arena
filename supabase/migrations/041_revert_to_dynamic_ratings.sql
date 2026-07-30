-- Migration: 041_revert_to_dynamic_ratings.sql
-- Description: Revert the attribute calculations back to the dynamic "global_stat_distributions" (comparing everyone to everyone) while keeping the real-time triggers and the new Play Style CTE rules.

-- 1. Refresh All Players (Bulk)
CREATE OR REPLACE FUNCTION rpc_refresh_all_player_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dist RECORD;
BEGIN
    -- 1. Refresh global distributions concurrently
    REFRESH MATERIALIZED VIEW CONCURRENTLY global_stat_distributions;

    -- 2. Fetch the dynamic global curve
    SELECT * INTO dist FROM global_stat_distributions WHERE id = 1;
    IF NOT FOUND THEN RETURN; END IF;

    -- 3. Calculate and update ratings for all players
    INSERT INTO player_attribute_ratings (
        player_id, shooting_score, passing_score, possession_score, 
        defending_score, finishing_score, discipline_score, overall_rating, play_style, updated_at
    )
    SELECT 
        ps.player_id,
        ROUND(
            (fn_normalize_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), dist.min_goals, dist.max_goals) * 0.4) +
            (fn_normalize_score(ps.total_shots::numeric / GREATEST(ps.matches_played, 1), dist.min_shots, dist.max_shots) * 0.2) +
            (fn_normalize_score(ps.total_shots_on_target::numeric / GREATEST(ps.matches_played, 1), dist.min_sot, dist.max_sot) * 0.2) +
            (fn_normalize_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, dist.min_shot_acc, dist.max_shot_acc) * 0.2)
        ) as shooting_score,
        ROUND(
            (fn_normalize_score(CASE WHEN ps.total_passes > 0 THEN (ps.total_successful_passes::numeric / ps.total_passes) * 100 ELSE 0 END, dist.min_pass_acc, dist.max_pass_acc) * 0.6) +
            (fn_normalize_score(ps.total_passes::numeric / GREATEST(ps.matches_played, 1), dist.min_passes, dist.max_passes) * 0.4)
        ) as passing_score,
        fn_normalize_score(ps.total_possession::numeric / GREATEST(ps.matches_played, 1), dist.min_poss, dist.max_poss) as possession_score,
        ROUND(
            (fn_normalize_score(ps.total_tackles::numeric / GREATEST(ps.matches_played, 1), dist.min_tackles, dist.max_tackles) * 0.4) +
            (fn_normalize_score(ps.total_interceptions::numeric / GREATEST(ps.matches_played, 1), dist.min_interceptions, dist.max_interceptions) * 0.4) +
            (fn_normalize_score(ps.total_saves::numeric / GREATEST(ps.matches_played, 1), dist.min_saves, dist.max_saves) * 0.2)
        ) as defending_score,
        ROUND(
            (fn_normalize_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), dist.min_goals, dist.max_goals) * 0.5) +
            (fn_normalize_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, dist.min_shot_acc, dist.max_shot_acc) * 0.5)
        ) as finishing_score,
        fn_normalize_score(ps.total_fouls::numeric / GREATEST(ps.matches_played, 1), dist.min_fouls, dist.max_fouls, true) as discipline_score,
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

    -- 4. Update Overall Rating First
    UPDATE player_attribute_ratings par
    SET 
        overall_rating = ROUND(
            (par.shooting_score * 0.2) + 
            (par.passing_score * 0.2) + 
            (par.possession_score * 0.2) + 
            (par.defending_score * 0.2) + 
            (par.finishing_score * 0.1) + 
            (par.discipline_score * 0.1)
        ),
        rating_confidence = CASE 
            WHEN ps.matches_played >= 15 THEN 'High'
            WHEN ps.matches_played >= 5 THEN 'Medium'
            ELSE 'Low'
        END
    FROM player_statistics ps
    WHERE par.player_id = ps.player_id;

    -- 5. Compute derived metrics and update Play Style
    WITH player_metrics AS (
        SELECT player_id, matches_played,
               (total_goals::numeric / GREATEST(matches_played, 1)) AS goals_per_game,
               (total_shots::numeric / GREATEST(matches_played, 1)) AS shots_per_game,
               (total_tackles::numeric / GREATEST(matches_played, 1)) AS tackles_per_game,
               (total_interceptions::numeric / GREATEST(matches_played, 1)) AS interceptions_per_game,
               (total_saves::numeric / GREATEST(matches_played, 1)) AS saves_per_game,
               (total_fouls::numeric / GREATEST(matches_played, 1)) AS fouls_per_game,
               (total_possession::numeric / GREATEST(matches_played, 1)) AS avg_possession,
               (CASE WHEN total_shots > 0 THEN (total_shots_on_target::numeric / total_shots) * 100 ELSE 0 END) AS shot_accuracy,
               (CASE WHEN total_passes > 0 THEN (total_successful_passes::numeric / total_passes) * 100 ELSE 0 END) AS pass_accuracy
        FROM player_statistics
    )
    UPDATE player_attribute_ratings par
    SET play_style = CASE
        WHEN pm.matches_played < 3 THEN 'Amateur'
        WHEN par.finishing_score >= 90 AND par.shooting_score >= 85 AND pm.goals_per_game >= 2 AND pm.shot_accuracy >= 70 THEN 'Clinical Finisher'
        WHEN par.shooting_score >= 90 AND pm.shots_per_game >= 8 AND pm.shot_accuracy >= 75 THEN 'Sharpshooter'
        WHEN par.passing_score >= 88 AND pm.pass_accuracy >= 80 THEN 'Playmaker'
        WHEN par.possession_score >= 85 AND pm.avg_possession >= 60 AND pm.pass_accuracy >= 75 THEN 'Possession Master'
        WHEN par.defending_score >= 90 AND pm.tackles_per_game >= 8 AND pm.interceptions_per_game >= 6 THEN 'Defensive Wall'
        WHEN par.possession_score < 55 AND pm.goals_per_game >= 2 AND pm.shot_accuracy >= 70 THEN 'Counter Attacker'
        WHEN par.shooting_score >= 82 AND par.finishing_score >= 82 AND pm.goals_per_game >= 1.5 THEN 'All-Out Attacker'
        WHEN par.overall_rating >= 82 AND (GREATEST(par.shooting_score, par.passing_score, par.possession_score, par.defending_score, par.finishing_score, par.discipline_score) - LEAST(par.shooting_score, par.passing_score, par.possession_score, par.defending_score, par.finishing_score, par.discipline_score)) <= 10 THEN 'Tactical Player'
        WHEN par.shooting_score BETWEEN 70 AND 85 AND par.passing_score BETWEEN 70 AND 85 AND par.possession_score BETWEEN 70 AND 85 AND par.defending_score BETWEEN 70 AND 85 AND par.finishing_score BETWEEN 70 AND 85 AND par.discipline_score BETWEEN 70 AND 85 THEN 'Balanced Player'
        WHEN par.defending_score >= 80 AND par.discipline_score < 60 AND pm.fouls_per_game >= 3 THEN 'Aggressive Defender'
        ELSE 'Balanced Player'
    END
    FROM player_metrics pm
    WHERE par.player_id = pm.player_id;
END;
$$;


-- 2. Refresh Single Player (Real-Time)
CREATE OR REPLACE FUNCTION rpc_refresh_single_player_rating(p_player_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dist RECORD;
BEGIN
    -- Fetch the cached global curve (no need to refresh the materialized view for a single user update, it will use the cached state)
    SELECT * INTO dist FROM global_stat_distributions WHERE id = 1;
    IF NOT FOUND THEN RETURN; END IF;

    -- Calculate base attribute ratings using dynamic global distributions
    INSERT INTO player_attribute_ratings (
        player_id, shooting_score, passing_score, possession_score, 
        defending_score, finishing_score, discipline_score, overall_rating, play_style, updated_at
    )
    SELECT 
        ps.player_id,
        ROUND(
            (fn_normalize_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), dist.min_goals, dist.max_goals) * 0.4) +
            (fn_normalize_score(ps.total_shots::numeric / GREATEST(ps.matches_played, 1), dist.min_shots, dist.max_shots) * 0.2) +
            (fn_normalize_score(ps.total_shots_on_target::numeric / GREATEST(ps.matches_played, 1), dist.min_sot, dist.max_sot) * 0.2) +
            (fn_normalize_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, dist.min_shot_acc, dist.max_shot_acc) * 0.2)
        ) as shooting_score,
        ROUND(
            (fn_normalize_score(CASE WHEN ps.total_passes > 0 THEN (ps.total_successful_passes::numeric / ps.total_passes) * 100 ELSE 0 END, dist.min_pass_acc, dist.max_pass_acc) * 0.6) +
            (fn_normalize_score(ps.total_passes::numeric / GREATEST(ps.matches_played, 1), dist.min_passes, dist.max_passes) * 0.4)
        ) as passing_score,
        fn_normalize_score(ps.total_possession::numeric / GREATEST(ps.matches_played, 1), dist.min_poss, dist.max_poss) as possession_score,
        ROUND(
            (fn_normalize_score(ps.total_tackles::numeric / GREATEST(ps.matches_played, 1), dist.min_tackles, dist.max_tackles) * 0.4) +
            (fn_normalize_score(ps.total_interceptions::numeric / GREATEST(ps.matches_played, 1), dist.min_interceptions, dist.max_interceptions) * 0.4) +
            (fn_normalize_score(ps.total_saves::numeric / GREATEST(ps.matches_played, 1), dist.min_saves, dist.max_saves) * 0.2)
        ) as defending_score,
        ROUND(
            (fn_normalize_score(ps.total_goals::numeric / GREATEST(ps.matches_played, 1), dist.min_goals, dist.max_goals) * 0.5) +
            (fn_normalize_score(CASE WHEN ps.total_shots > 0 THEN (ps.total_shots_on_target::numeric / ps.total_shots) * 100 ELSE 0 END, dist.min_shot_acc, dist.max_shot_acc) * 0.5)
        ) as finishing_score,
        fn_normalize_score(ps.total_fouls::numeric / GREATEST(ps.matches_played, 1), dist.min_fouls, dist.max_fouls, true) as discipline_score,
        50 as overall_rating,
        'Balanced Player' as play_style,
        NOW() as updated_at
    FROM player_statistics ps
    WHERE ps.player_id = p_player_id AND ps.matches_played > 0
    ON CONFLICT (player_id) DO UPDATE SET
        shooting_score = EXCLUDED.shooting_score,
        passing_score = EXCLUDED.passing_score,
        possession_score = EXCLUDED.possession_score,
        defending_score = EXCLUDED.defending_score,
        finishing_score = EXCLUDED.finishing_score,
        discipline_score = EXCLUDED.discipline_score,
        updated_at = EXCLUDED.updated_at;

    -- Update Overall Rating First
    UPDATE player_attribute_ratings par
    SET 
        overall_rating = ROUND(
            (par.shooting_score * 0.2) + 
            (par.passing_score * 0.2) + 
            (par.possession_score * 0.2) + 
            (par.defending_score * 0.2) + 
            (par.finishing_score * 0.1) + 
            (par.discipline_score * 0.1)
        ),
        rating_confidence = CASE 
            WHEN ps.matches_played >= 15 THEN 'High'
            WHEN ps.matches_played >= 5 THEN 'Medium'
            ELSE 'Low'
        END
    FROM player_statistics ps
    WHERE par.player_id = p_player_id AND ps.player_id = p_player_id;

    -- Compute derived metrics and update Play Style
    WITH player_metrics AS (
        SELECT player_id, matches_played,
               (total_goals::numeric / GREATEST(matches_played, 1)) AS goals_per_game,
               (total_shots::numeric / GREATEST(matches_played, 1)) AS shots_per_game,
               (total_tackles::numeric / GREATEST(matches_played, 1)) AS tackles_per_game,
               (total_interceptions::numeric / GREATEST(matches_played, 1)) AS interceptions_per_game,
               (total_saves::numeric / GREATEST(matches_played, 1)) AS saves_per_game,
               (total_fouls::numeric / GREATEST(matches_played, 1)) AS fouls_per_game,
               (total_possession::numeric / GREATEST(matches_played, 1)) AS avg_possession,
               (CASE WHEN total_shots > 0 THEN (total_shots_on_target::numeric / total_shots) * 100 ELSE 0 END) AS shot_accuracy,
               (CASE WHEN total_passes > 0 THEN (total_successful_passes::numeric / total_passes) * 100 ELSE 0 END) AS pass_accuracy
        FROM player_statistics
        WHERE player_id = p_player_id
    )
    UPDATE player_attribute_ratings par
    SET play_style = CASE
        WHEN pm.matches_played < 3 THEN 'Amateur'
        WHEN par.finishing_score >= 90 AND par.shooting_score >= 85 AND pm.goals_per_game >= 2 AND pm.shot_accuracy >= 70 THEN 'Clinical Finisher'
        WHEN par.shooting_score >= 90 AND pm.shots_per_game >= 8 AND pm.shot_accuracy >= 75 THEN 'Sharpshooter'
        WHEN par.passing_score >= 88 AND pm.pass_accuracy >= 80 THEN 'Playmaker'
        WHEN par.possession_score >= 85 AND pm.avg_possession >= 60 AND pm.pass_accuracy >= 75 THEN 'Possession Master'
        WHEN par.defending_score >= 90 AND pm.tackles_per_game >= 8 AND pm.interceptions_per_game >= 6 THEN 'Defensive Wall'
        WHEN par.possession_score < 55 AND pm.goals_per_game >= 2 AND pm.shot_accuracy >= 70 THEN 'Counter Attacker'
        WHEN par.shooting_score >= 82 AND par.finishing_score >= 82 AND pm.goals_per_game >= 1.5 THEN 'All-Out Attacker'
        WHEN par.overall_rating >= 82 AND (GREATEST(par.shooting_score, par.passing_score, par.possession_score, par.defending_score, par.finishing_score, par.discipline_score) - LEAST(par.shooting_score, par.passing_score, par.possession_score, par.defending_score, par.finishing_score, par.discipline_score)) <= 10 THEN 'Tactical Player'
        WHEN par.shooting_score BETWEEN 70 AND 85 AND par.passing_score BETWEEN 70 AND 85 AND par.possession_score BETWEEN 70 AND 85 AND par.defending_score BETWEEN 70 AND 85 AND par.finishing_score BETWEEN 70 AND 85 AND par.discipline_score BETWEEN 70 AND 85 THEN 'Balanced Player'
        WHEN par.defending_score >= 80 AND par.discipline_score < 60 AND pm.fouls_per_game >= 3 THEN 'Aggressive Defender'
        ELSE 'Balanced Player'
    END
    FROM player_metrics pm
    WHERE par.player_id = p_player_id AND pm.player_id = p_player_id;
END;
$$;

-- Instantly recalculate everyone right now
SELECT rpc_refresh_all_player_ratings();
