-- Migration: 044_player_avatars.sql

CREATE TABLE IF NOT EXISTS player_avatars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Seed demo avatar
INSERT INTO player_avatars (id, name, image_url) VALUES 
('11111111-1111-1111-1111-111111111111', 'Demo Soccer Ball', 'https://api.dicebear.com/7.x/shapes/svg?seed=soccer')
ON CONFLICT DO NOTHING;

-- Add avatar_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES player_avatars(id) ON DELETE SET NULL;

-- Enable RLS on player_avatars
ALTER TABLE player_avatars ENABLE ROW LEVEL SECURITY;

-- Allow public read access to avatars
DROP POLICY IF EXISTS "Avatars viewable by all" ON player_avatars;
CREATE POLICY "Avatars viewable by all" ON player_avatars FOR SELECT USING (true);

-- Allow admins to manage avatars (assuming role-based logic or manual DB management)
DROP POLICY IF EXISTS "Admins can insert avatars" ON player_avatars;
CREATE POLICY "Admins can insert avatars" ON player_avatars FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.role = 'service_role')
);

DROP POLICY IF EXISTS "Admins can update avatars" ON player_avatars;
CREATE POLICY "Admins can update avatars" ON player_avatars FOR UPDATE USING (
  EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.role = 'service_role')
);

DROP POLICY IF EXISTS "Admins can delete avatars" ON player_avatars;
CREATE POLICY "Admins can delete avatars" ON player_avatars FOR DELETE USING (
  EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.role = 'service_role')
);
