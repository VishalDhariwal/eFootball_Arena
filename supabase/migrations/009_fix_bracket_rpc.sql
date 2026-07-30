-- Migration: 009_fix_bracket_rpc.sql
-- Description: Updates the generate_single_elimination_bracket function to be SECURITY DEFINER to bypass RLS when generating bracket data.

CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(
    p_tournament_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_round_duration_minutes INT
)
RETURNS VOID AS $$
DECLARE
    v_players UUID[];
    v_num_players INT;
    v_p INT;
    v_total_rounds INT;
    v_round_ids UUID[];
    v_next_match_ids UUID[];
    v_round_names TEXT[] := ARRAY['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Round of 64', 'Round of 128'];
    v_player_index INT := 1;
BEGIN
    -- 0. Check if caller is authorized (organizer)
    IF NOT EXISTS (
        SELECT 1 FROM tournaments 
        WHERE id = p_tournament_id AND organizer_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized. Only the tournament organizer can generate the bracket.';
    END IF;

    -- 1. Get all paid players in random order
    SELECT array_agg(user_id ORDER BY random())
    INTO v_players
    FROM registrations
    WHERE tournament_id = p_tournament_id AND payment_status = 'paid';

    v_num_players := array_length(v_players, 1);
    
    IF v_num_players IS NULL OR v_num_players < 2 THEN
        RAISE EXCEPTION 'Not enough paid players to generate a bracket (minimum 2).';
    END IF;

    -- 2. Calculate power of 2
    v_p := 1;
    v_total_rounds := 0;
    WHILE v_p < v_num_players LOOP
        v_p := v_p * 2;
        v_total_rounds := v_total_rounds + 1;
    END LOOP;

    -- 3. Create Rounds
    v_round_ids := ARRAY[]::UUID[];
    FOR r IN 1..v_total_rounds LOOP
        DECLARE
            v_round_id UUID := gen_random_uuid();
            v_round_name TEXT;
        BEGIN
            -- Round 1 is the highest number (e.g. Quarterfinals), Round v_total_rounds is the Final
            IF (v_total_rounds - r + 1) <= array_length(v_round_names, 1) THEN
                v_round_name := v_round_names[v_total_rounds - r + 1];
            ELSE
                v_round_name := 'Round ' || r;
            END IF;

            INSERT INTO rounds (id, tournament_id, name, order_index)
            VALUES (v_round_id, p_tournament_id, v_round_name, r);
            
            v_round_ids := array_append(v_round_ids, v_round_id);
        END;
    END LOOP;

    -- 4. Create Matches
    v_next_match_ids := ARRAY[]::UUID[];
    
    FOR r IN REVERSE v_total_rounds..1 LOOP
        DECLARE
            v_matches_in_round INT := power(2, v_total_rounds - r);
            v_current_round_match_ids UUID[] := ARRAY[]::UUID[];
            v_round_start TIMESTAMP WITH TIME ZONE := p_start_time + ((r - 1) * p_round_duration_minutes * interval '1 minute');
            v_round_deadline TIMESTAMP WITH TIME ZONE := v_round_start + (p_round_duration_minutes * interval '1 minute');
        BEGIN
            FOR m IN 1..v_matches_in_round LOOP
                DECLARE
                    v_match_id UUID := gen_random_uuid();
                    v_next_id UUID := NULL;
                    v_p1 UUID := NULL;
                    v_p2 UUID := NULL;
                    v_status TEXT := 'scheduled';
                BEGIN
                    -- Link to next match if not final
                    IF r < v_total_rounds THEN
                        v_next_id := v_next_match_ids[ceiling(m::numeric / 2.0)];
                    END IF;

                    -- If this is the first round, assign players
                    IF r = 1 THEN
                        IF v_player_index <= v_num_players THEN
                            v_p1 := v_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        
                        IF v_player_index <= v_num_players THEN
                            v_p2 := v_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;

                        -- Handle Byes (if missing player)
                        IF v_p1 IS NOT NULL AND v_p2 IS NULL THEN
                            v_status := 'walkover';
                            -- Winner is technically p1, but they advance automatically.
                        ELSIF v_p1 IS NULL AND v_p2 IS NOT NULL THEN
                            v_status := 'walkover';
                        END IF;
                    END IF;

                    INSERT INTO matches (id, tournament_id, round_id, player1_id, player2_id, status, scheduled_time, deadline)
                    VALUES (v_match_id, p_tournament_id, v_round_ids[r], v_p1, v_p2, v_status, v_round_start, v_round_deadline);

                    INSERT INTO brackets (tournament_id, match_id, next_match_id, position)
                    VALUES (p_tournament_id, v_match_id, v_next_id, m);

                    v_current_round_match_ids := array_append(v_current_round_match_ids, v_match_id);
                END;
            END LOOP;
            
            v_next_match_ids := v_current_round_match_ids;
        END;
    END LOOP;

    -- 5. Update tournament status
    UPDATE tournaments SET status = 'live' WHERE id = p_tournament_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
