-- Advanced Row Level Security (Milestone 5)

-- Drop the simple policies created in 001 if they exist
DROP POLICY IF EXISTS "Tournaments are viewable by everyone." ON tournaments;
DROP POLICY IF EXISTS "Users can create tournaments." ON tournaments;
DROP POLICY IF EXISTS "Organizers can update their tournaments." ON tournaments;

DROP POLICY IF EXISTS "Registrations are viewable by everyone." ON registrations;
DROP POLICY IF EXISTS "Users can register themselves." ON registrations;

DROP POLICY IF EXISTS "Matches are viewable by everyone." ON matches;

DROP POLICY IF EXISTS "Submissions viewable by participants and admins." ON match_submissions;
DROP POLICY IF EXISTS "Players can insert own submissions." ON match_submissions;

-- 1. Tournaments Policies
-- Read: Public
CREATE POLICY "Public can view tournaments" 
ON tournaments FOR SELECT USING (true);

-- Insert: Only users can create (they become the organizer)
CREATE POLICY "Authenticated users can create tournaments" 
ON tournaments FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- Update: Only the organizer can update
CREATE POLICY "Organizers can update their tournaments" 
ON tournaments FOR UPDATE USING (auth.uid() = organizer_id);

-- Delete: Only the organizer can delete
CREATE POLICY "Organizers can delete their tournaments" 
ON tournaments FOR DELETE USING (auth.uid() = organizer_id);

-- 2. Registrations Policies
-- Read: Public
CREATE POLICY "Public can view registrations" 
ON registrations FOR SELECT USING (true);

-- Insert: Users can only register themselves
CREATE POLICY "Users can register themselves" 
ON registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update: Only tournament organizers can update payment_status
CREATE POLICY "Tournament organizers can update registrations" 
ON registrations FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = registrations.tournament_id
        AND t.organizer_id = auth.uid()
    )
);

-- Delete: User can cancel registration OR organizer can remove
CREATE POLICY "Users or organizers can delete registrations" 
ON registrations FOR DELETE 
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = registrations.tournament_id
        AND t.organizer_id = auth.uid()
    )
);

-- 3. Matches Policies
-- Read: Public
CREATE POLICY "Public can view matches" 
ON matches FOR SELECT USING (true);

-- Update: Organizers can update matches (e.g. setting winner after verifying score)
CREATE POLICY "Tournament organizers can update matches" 
ON matches FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = matches.tournament_id
        AND t.organizer_id = auth.uid()
    )
);

-- 4. Match Submissions
-- Read: Participants or Organizers
CREATE POLICY "Participants and Organizers can view submissions" 
ON match_submissions FOR SELECT 
USING (
    auth.uid() = player_id OR
    EXISTS (
        SELECT 1 FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        WHERE m.id = match_submissions.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid() OR t.organizer_id = auth.uid())
    )
);

-- Insert: Only participants of the match can submit
CREATE POLICY "Match participants can submit scores" 
ON match_submissions FOR INSERT 
WITH CHECK (
    auth.uid() = player_id AND
    EXISTS (
        SELECT 1 FROM matches m
        WHERE m.id = match_submissions.match_id
        AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
);

-- Update: Organizers can update status (verify/reject)
CREATE POLICY "Organizers can verify submissions" 
ON match_submissions FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        WHERE m.id = match_submissions.match_id
        AND t.organizer_id = auth.uid()
    )
);
