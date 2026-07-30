-- Migration: 005_dispute_resolution.sql
-- Description: RPC function for admins/organizers to manually resolve disputed matches

CREATE OR REPLACE FUNCTION resolve_dispute(
    p_match_id UUID,
    p_winner_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_match_id UUID;
    v_position INT;
    v_tournament_id UUID;
BEGIN
    -- 1. Update the match to verified and set the winner
    UPDATE matches 
    SET status = 'verified', 
        winner_id = p_winner_id 
    WHERE id = p_match_id;

    -- 2. Find the next match in the bracket and get tournament_id
    SELECT next_match_id, position, tournament_id 
    INTO v_next_match_id, v_position, v_tournament_id 
    FROM brackets 
    WHERE match_id = p_match_id;

    -- 3. If there is a next match, advance the winner
    IF v_next_match_id IS NOT NULL THEN
        -- Odd positions (1, 3, 5) go to player1 slot
        -- Even positions (2, 4, 6) go to player2 slot
        IF v_position % 2 = 1 THEN
            UPDATE matches SET player1_id = p_winner_id WHERE id = v_next_match_id;
        ELSE
            UPDATE matches SET player2_id = p_winner_id WHERE id = v_next_match_id;
        END IF;
        
        -- Run sweep to auto-resolve any empty branches this winner just entered
        PERFORM sweep_bracket(v_tournament_id);
    END IF;
END;
$$;
