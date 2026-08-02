-- Migration: 057_hall_of_champions.sql
-- Description: Add matches_played to season_archives and champion flags to profiles. Update rpc_end_season.

-- 1. Add matches_played to season_archives
ALTER TABLE season_archives 
ADD COLUMN IF NOT EXISTS matches_played INT DEFAULT 0;

-- 2. Add champion flags to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_champion BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS champion_season TEXT;

-- 3. Update the Season Reset RPC to capture matches_played and update champion profiles
CREATE OR REPLACE FUNCTION rpc_end_season(p_season_name TEXT)
RETURNS void AS $$
DECLARE
    v_player record;
    v_rank INT := 1;
BEGIN
    -- 1. Clear previous champions
    UPDATE profiles SET is_champion = false;

    -- 2. Archive Top Players and Stats
    -- Fetch everyone ordered by ELO and archive them
    FOR v_player IN (
        SELECT p.id, p.elo_rating, ps.matches_played, COALESCE(
            (SELECT COUNT(*) FROM matches m WHERE m.winner_id = p.id AND m.status = 'verified'), 0
        ) as total_wins
        FROM profiles p
        LEFT JOIN player_statistics ps ON ps.player_id = p.id
        ORDER BY p.elo_rating DESC, COALESCE(ps.matches_played, 0) DESC
    )
    LOOP
        -- Only archive if they've played at least 1 match this season
        IF COALESCE(v_player.matches_played, 0) > 0 THEN
            INSERT INTO season_archives (season_name, player_id, final_ar, global_rank, total_wins, matches_played)
            VALUES (p_season_name, v_player.id, v_player.elo_rating, v_rank, v_player.total_wins, COALESCE(v_player.matches_played, 0));
            
            -- If this player is rank 1, they are the champion!
            IF v_rank = 1 THEN
                UPDATE profiles 
                SET is_champion = true, 
                    champion_season = p_season_name
                WHERE id = v_player.id;
            END IF;

            v_rank := v_rank + 1;
        END IF;
    END LOOP;

    -- 2. Execute Soft Reset (Compression) for ALL players
    UPDATE profiles 
    SET elo_rating = ROUND((elo_rating + 1000) / 2.0);

    -- 3. Reset matches_played and stats for the new season
    -- (Assuming player_statistics is updated or kept, but for a true season reset, we might want to reset stats here if desired. 
    -- Currently, the system uses overall stats in player_statistics. If we wanted seasonal stats, we'd reset player_statistics here.)

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the dummy champion (Kunal) in profiles so the frontend shows it immediately
-- First, clear everyone
UPDATE profiles SET is_champion = false;
-- Then set the new one
UPDATE profiles 
SET is_champion = true,
    champion_season = 'Season ' || to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')
WHERE id = (SELECT player_id FROM season_archives WHERE global_rank = 1 ORDER BY created_at DESC LIMIT 1);
