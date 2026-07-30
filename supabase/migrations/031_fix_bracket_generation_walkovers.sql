-- Migration: 031_fix_bracket_generation_walkovers.sql
-- Description: Fix bracket generation to let sweep_bracket handle walkovers cleanly.

-- 1. Fix auto-generation
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
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM tournaments 
    WHERE id = p_tournament_id AND organizer_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not authorized. Only the tournament organizer can generate the bracket.';
    END IF;

    IF v_status NOT IN ('registration', 'upcoming') THEN
        RAISE EXCEPTION 'Cannot generate bracket: Tournament is not in registration or upcoming phase.';
    END IF;

    SELECT array_agg(user_id ORDER BY random())
    INTO v_players
    FROM registrations
    WHERE tournament_id = p_tournament_id AND payment_status = 'paid';

    v_num_players := array_length(v_players, 1);
    
    IF v_num_players IS NULL OR v_num_players < 2 THEN
        RAISE EXCEPTION 'Not enough paid players to generate a bracket (minimum 2).';
    END IF;

    v_p := 1;
    v_total_rounds := 0;
    WHILE v_p < v_num_players LOOP
        v_p := v_p * 2;
        v_total_rounds := v_total_rounds + 1;
    END LOOP;

    v_round_ids := ARRAY[]::UUID[];
    FOR r IN 1..v_total_rounds LOOP
        DECLARE
            v_round_id UUID := gen_random_uuid();
            v_round_name TEXT;
        BEGIN
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
                    v_status_match TEXT := 'scheduled';
                BEGIN
                    IF r < v_total_rounds THEN
                        v_next_id := v_next_match_ids[ceiling(m::numeric / 2.0)];
                    END IF;

                    IF r = 1 THEN
                        IF v_player_index <= v_num_players THEN
                            v_p1 := v_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        
                        IF v_player_index <= v_num_players THEN
                            v_p2 := v_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        -- Removed manual walkover logic here.
                        -- sweep_bracket will automatically detect empty slots and advance players cleanly.
                    END IF;

                    INSERT INTO matches (id, tournament_id, round_id, player1_id, player2_id, status, scheduled_time, deadline)
                    VALUES (v_match_id, p_tournament_id, v_round_ids[r], v_p1, v_p2, v_status_match, v_round_start, v_round_deadline);

                    INSERT INTO brackets (tournament_id, match_id, next_match_id, position)
                    VALUES (p_tournament_id, v_match_id, v_next_id, m);

                    v_current_round_match_ids := array_append(v_current_round_match_ids, v_match_id);
                END;
            END LOOP;
            
            v_next_match_ids := v_current_round_match_ids;
        END;
    END LOOP;

    UPDATE tournaments SET status = 'live' WHERE id = p_tournament_id;

    -- Sweep bracket so walkovers automatically advance to their respective matches
    PERFORM sweep_bracket(p_tournament_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix manual generation
CREATE OR REPLACE FUNCTION generate_manual_bracket(
    p_tournament_id UUID,
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_round_duration_minutes INT,
    p_players UUID[]
)
RETURNS VOID AS $$
DECLARE
    v_num_players INT;
    v_p INT;
    v_total_rounds INT;
    v_round_ids UUID[];
    v_next_match_ids UUID[];
    v_round_names TEXT[] := ARRAY['Final', 'Semifinals', 'Quarterfinals', 'Round of 16', 'Round of 32', 'Round of 64', 'Round of 128'];
    v_player_index INT := 1;
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM tournaments 
    WHERE id = p_tournament_id AND organizer_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not authorized. Only the tournament organizer can generate the bracket.';
    END IF;

    IF v_status NOT IN ('registration', 'upcoming') THEN
        RAISE EXCEPTION 'Cannot generate bracket: Tournament is not in registration or upcoming phase.';
    END IF;

    v_num_players := array_length(p_players, 1);
    
    IF v_num_players IS NULL OR v_num_players < 2 THEN
        RAISE EXCEPTION 'Not enough players to generate a bracket (minimum 2).';
    END IF;

    v_p := 1;
    v_total_rounds := 0;
    WHILE v_p < v_num_players LOOP
        v_p := v_p * 2;
        v_total_rounds := v_total_rounds + 1;
    END LOOP;

    v_round_ids := ARRAY[]::UUID[];
    FOR r IN 1..v_total_rounds LOOP
        DECLARE
            v_round_id UUID := gen_random_uuid();
            v_round_name TEXT;
        BEGIN
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
                    v_status_match TEXT := 'scheduled';
                BEGIN
                    IF r < v_total_rounds THEN
                        v_next_id := v_next_match_ids[ceiling(m::numeric / 2.0)];
                    END IF;

                    IF r = 1 THEN
                        IF v_player_index <= v_num_players THEN
                            v_p1 := p_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        
                        IF v_player_index <= v_num_players THEN
                            v_p2 := p_players[v_player_index];
                            v_player_index := v_player_index + 1;
                        END IF;
                        
                        -- Removed manual walkover logic here.
                        -- sweep_bracket will automatically detect empty slots and advance players cleanly.
                    END IF;

                    INSERT INTO matches (id, tournament_id, round_id, player1_id, player2_id, status, scheduled_time, deadline)
                    VALUES (v_match_id, p_tournament_id, v_round_ids[r], v_p1, v_p2, v_status_match, v_round_start, v_round_deadline);

                    INSERT INTO brackets (tournament_id, match_id, next_match_id, position)
                    VALUES (p_tournament_id, v_match_id, v_next_id, m);

                    v_current_round_match_ids := array_append(v_current_round_match_ids, v_match_id);
                END;
            END LOOP;
            
            v_next_match_ids := v_current_round_match_ids;
        END;
    END LOOP;

    UPDATE tournaments SET status = 'live' WHERE id = p_tournament_id;
    
    -- Sweep bracket so walkovers automatically advance to their respective matches
    PERFORM sweep_bracket(p_tournament_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
