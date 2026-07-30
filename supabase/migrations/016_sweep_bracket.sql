-- Migration: 016_sweep_bracket.sql
-- Description: Auto-resolves brackets when branches are empty, granting walkovers seamlessly.

CREATE OR REPLACE FUNCTION sweep_bracket(p_tournament_id UUID)
RETURNS VOID AS $$
DECLARE
    v_round RECORD;
    v_match RECORD;
    v_prev_m1_status TEXT;
    v_prev_m2_status TEXT;
    v_new_winner UUID;
    v_next_match_id UUID;
    v_position INT;
    v_slot1_empty BOOLEAN;
    v_slot2_empty BOOLEAN;
BEGIN
    -- Loop through rounds from 1 to Total
    FOR v_round IN 
        SELECT id FROM rounds 
        WHERE tournament_id = p_tournament_id 
        ORDER BY order_index ASC 
    LOOP
        -- Loop through matches in this round
        FOR v_match IN 
            SELECT * FROM matches 
            WHERE round_id = v_round.id 
            AND status = 'scheduled'
        LOOP
            v_prev_m1_status := NULL;
            v_prev_m2_status := NULL;
            v_new_winner := NULL;

            -- Find previous matches feeding into this one
            SELECT status INTO v_prev_m1_status FROM matches 
            WHERE id = (SELECT match_id FROM brackets WHERE next_match_id = v_match.id AND position % 2 = 1);
            
            SELECT status INTO v_prev_m2_status FROM matches 
            WHERE id = (SELECT match_id FROM brackets WHERE next_match_id = v_match.id AND position % 2 = 0);
            
            -- A slot is empty if it has no player AND (there is no previous match OR previous match is cancelled)
            v_slot1_empty := (v_match.player1_id IS NULL AND (v_prev_m1_status = 'cancelled' OR v_prev_m1_status IS NULL));
            v_slot2_empty := (v_match.player2_id IS NULL AND (v_prev_m2_status = 'cancelled' OR v_prev_m2_status IS NULL));
            
            IF v_slot1_empty AND v_slot2_empty THEN
                UPDATE matches SET status = 'cancelled' WHERE id = v_match.id;
            ELSIF v_slot1_empty AND v_match.player2_id IS NOT NULL THEN
                v_new_winner := v_match.player2_id;
                UPDATE matches SET status = 'walkover', winner_id = v_new_winner WHERE id = v_match.id;
            ELSIF v_slot2_empty AND v_match.player1_id IS NOT NULL THEN
                v_new_winner := v_match.player1_id;
                UPDATE matches SET status = 'walkover', winner_id = v_new_winner WHERE id = v_match.id;
            END IF;

            -- If we determined a walkover winner, push them to the next match immediately
            IF v_new_winner IS NOT NULL THEN
                SELECT next_match_id, position INTO v_next_match_id, v_position 
                FROM brackets WHERE match_id = v_match.id;
                
                IF v_next_match_id IS NOT NULL THEN
                    IF v_position % 2 = 1 THEN
                        UPDATE matches SET player1_id = v_new_winner WHERE id = v_next_match_id;
                    ELSE
                        UPDATE matches SET player2_id = v_new_winner WHERE id = v_next_match_id;
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
