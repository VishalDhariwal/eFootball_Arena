-- Core Schema for eFootball Arena (Milestone 3)

-- 1. Profiles (Extends auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    game_id TEXT, -- eFootball Game ID
    player_id TEXT UNIQUE NOT NULL, -- e.g. PLR-A7X9
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
ON profiles FOR SELECT
USING ( true );

CREATE POLICY "Users can insert their own profile."
ON profiles FOR INSERT
WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
ON profiles FOR UPDATE
USING ( auth.uid() = id );

-- 2. Roles & User Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL -- 'player', 'organizer', 'admin'
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles are viewable by everyone" ON roles FOR SELECT USING (true);
CREATE POLICY "User roles are viewable by everyone" ON user_roles FOR SELECT USING (true);

-- 3. Tournaments
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming', -- upcoming, registration, live, completed
    format TEXT NOT NULL, -- single_elimination, double_elimination, round_robin
    prize_pool TEXT,
    entry_fee DECIMAL DEFAULT 0,
    max_players INTEGER,
    start_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments are viewable by everyone." ON tournaments FOR SELECT USING (true);
-- Organizers can create/update (simplified for now)
CREATE POLICY "Users can create tournaments." ON tournaments FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update their tournaments." ON tournaments FOR UPDATE USING (auth.uid() = organizer_id);

-- 4. Registrations
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    payment_status TEXT DEFAULT 'pending', -- pending, paid, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(tournament_id, user_id)
);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registrations are viewable by everyone." ON registrations FOR SELECT USING (true);
CREATE POLICY "Users can register themselves." ON registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round_id UUID, -- Will point to rounds table
    player1_id UUID REFERENCES profiles(id),
    player2_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'scheduled', -- scheduled, live, waiting_submission, verifying, verified, disputed, walkover, cancelled, completed
    scheduled_time TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are viewable by everyone." ON matches FOR SELECT USING (true);
-- Updating matches will be handled securely via functions/RLS later

-- 6. Rounds
CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL
);

ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rounds viewable by everyone." ON rounds FOR SELECT USING (true);

-- 7. Brackets
CREATE TABLE brackets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    next_match_id UUID REFERENCES matches(id),
    position INTEGER
);

ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brackets viewable by everyone." ON brackets FOR SELECT USING (true);

-- 8. Match Submissions
CREATE TABLE match_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    score_reported TEXT NOT NULL,
    screenshot_path TEXT,
    status TEXT DEFAULT 'pending', -- pending, verified, rejected
    trust_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE match_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Submissions viewable by participants and admins." 
ON match_submissions FOR SELECT 
USING (
    auth.uid() = player_id 
    -- We will add admin/organizer access later
);
CREATE POLICY "Players can insert own submissions." 
ON match_submissions FOR INSERT 
WITH CHECK (auth.uid() = player_id);

-- Insert default roles
INSERT INTO roles (name) VALUES ('player'), ('organizer'), ('admin');
