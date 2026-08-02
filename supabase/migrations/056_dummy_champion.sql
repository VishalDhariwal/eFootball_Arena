-- Migration: 056_dummy_champion.sql
-- Description: Add Kunal Ahlawat as a dummy previous month winner for testing Leaderboard

DO $$
DECLARE
    v_user_id UUID;
    v_season_name TEXT;
BEGIN
    -- Look for the user
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'ahlawatkunal6266@gmail.com';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ahlawatkunal6266@gmail.com not found. Please ensure they are registered first!';
    END IF;

    v_season_name := 'Season ' || to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');

    -- Insert into season_archives as rank 1
    INSERT INTO season_archives (season_name, player_id, final_ar, global_rank, total_wins, created_at)
    VALUES (
        v_season_name,
        v_user_id,
        2100, -- Dummy high Arena Rating
        1,    -- Rank 1 (Champion)
        30,   -- Dummy wins
        CURRENT_DATE - INTERVAL '1 month'
    )
    ON CONFLICT DO NOTHING;

END
$$;
