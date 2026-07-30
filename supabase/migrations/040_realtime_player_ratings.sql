-- Migration: 040_realtime_player_ratings.sql
-- Description: Create a single-player rating refresh function and a trigger to calculate ratings in real-time.

CREATE OR REPLACE FUNCTION rpc_refresh_single_player_rating(p_player_id UUID)
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

    -- =========================================================================
    -- 1. Calculate and update base attribute ratings using realistic caps
    -- =========================================================================
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
    WHERE ps.player_id = p_player_id AND ps.matches_played > 0
    ON CONFLICT (player_id) DO UPDATE SET
        shooting_score = EXCLUDED.shooting_score,
        passing_score = EXCLUDED.passing_score,
        possession_score = EXCLUDED.possession_score,
        defending_score = EXCLUDED.defending_score,
        finishing_score = EXCLUDED.finishing_score,
        discipline_score = EXCLUDED.discipline_score,
        updated_at = EXCLUDED.updated_at;

    -- =========================================================================
    -- 2. Update Overall Rating First (Step 1 of Classification)
    -- =========================================================================
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
        END
    FROM player_statistics ps
    WHERE par.player_id = p_player_id AND ps.player_id = p_player_id;

    -- =========================================================================
    -- 3. Compute Derived Metrics and Update Play Style (Step 2 of Classification)
    -- =========================================================================
    WITH player_metrics AS (
        SELECT
            player_id,
            matches_played,
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
        -- 11. Minimum matches check (Evaluate first to avoid classifying rookies)
        WHEN pm.matches_played < 3 THEN 'Amateur'
        
        -- 1. Clinical Finisher
        WHEN par.finishing_score >= 90 AND par.shooting_score >= 85 AND pm.goals_per_game >= 2 AND pm.shot_accuracy >= 70 THEN 'Clinical Finisher'
        
        -- 2. Sharpshooter
        WHEN par.shooting_score >= 90 AND pm.shots_per_game >= 8 AND pm.shot_accuracy >= 75 THEN 'Sharpshooter'
        
        -- 3. Playmaker
        WHEN par.passing_score >= 88 AND pm.pass_accuracy >= 80 THEN 'Playmaker'
        
        -- 4. Possession Master
        WHEN par.possession_score >= 85 AND pm.avg_possession >= 60 AND pm.pass_accuracy >= 75 THEN 'Possession Master'
        
        -- 5. Defensive Wall
        WHEN par.defending_score >= 90 AND pm.tackles_per_game >= 8 AND pm.interceptions_per_game >= 6 THEN 'Defensive Wall'
        
        -- 6. Counter Attacker
        WHEN par.possession_score < 55 AND pm.goals_per_game >= 2 AND pm.shot_accuracy >= 70 THEN 'Counter Attacker'
        
        -- 7. All-Out Attacker
        WHEN par.shooting_score >= 82 AND par.finishing_score >= 82 AND pm.goals_per_game >= 1.5 THEN 'All-Out Attacker'
        
        -- 8. Tactical Player
        WHEN par.overall_rating >= 82 AND (GREATEST(par.shooting_score, par.passing_score, par.possession_score, par.defending_score, par.finishing_score, par.discipline_score) - LEAST(par.shooting_score, par.passing_score, par.possession_score, par.defending_score, par.finishing_score, par.discipline_score)) <= 10 THEN 'Tactical Player'
        
        -- 9. Balanced Player
        WHEN par.shooting_score BETWEEN 70 AND 85 
             AND par.passing_score BETWEEN 70 AND 85 
             AND par.possession_score BETWEEN 70 AND 85 
             AND par.defending_score BETWEEN 70 AND 85 
             AND par.finishing_score BETWEEN 70 AND 85 
             AND par.discipline_score BETWEEN 70 AND 85 THEN 'Balanced Player'
        
        -- 10. Aggressive Defender
        WHEN par.defending_score >= 80 AND par.discipline_score < 60 AND pm.fouls_per_game >= 3 THEN 'Aggressive Defender'
        
        -- 12. Default
        ELSE 'Balanced Player'
    END
    FROM player_metrics pm
    WHERE par.player_id = p_player_id AND pm.player_id = p_player_id;
END;
$$;


-- =========================================================================
-- 4. Create Trigger on player_statistics to automate ratings
-- =========================================================================
CREATE OR REPLACE FUNCTION trg_refresh_player_ratings_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if there is an actual player_id (e.g., avoiding edge cases)
    IF NEW.player_id IS NOT NULL THEN
        -- Safely run the single player rating refresh
        PERFORM rpc_refresh_single_player_rating(NEW.player_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_refresh_player_ratings ON player_statistics;
CREATE TRIGGER trg_refresh_player_ratings
AFTER INSERT OR UPDATE ON player_statistics
FOR EACH ROW EXECUTE FUNCTION trg_refresh_player_ratings_func();
