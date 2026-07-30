-- Migration: 032_fix_stuck_tournaments.sql
-- Description: Fix tournaments where walkovers got stuck without winner_id.

DO $$
DECLARE
    v_match RECORD;
BEGIN
    -- 1. Give all stuck walkover matches their winner_id and set them to scheduled
    -- so sweep_bracket can process them correctly.
    FOR v_match IN 
        SELECT * FROM matches 
        WHERE status = 'walkover' AND winner_id IS NULL
    LOOP
        IF v_match.player1_id IS NOT NULL THEN
            UPDATE matches SET status = 'scheduled', winner_id = NULL WHERE id = v_match.id;
        ELSIF v_match.player2_id IS NOT NULL THEN
            UPDATE matches SET status = 'scheduled', winner_id = NULL WHERE id = v_match.id;
        END IF;
    END LOOP;

    -- 2. Run sweep_bracket for all live tournaments to properly resolve those scheduled matches into walkovers
    FOR v_match IN 
        SELECT id FROM tournaments WHERE status = 'live'
    LOOP
        PERFORM sweep_bracket(v_match.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
