-- 17_user_playlists.sql

-- 1. Add Ownership and Visibility to Playlists
ALTER TABLE public.playlists 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'unlisted')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Note: owner_id IS NULL implies it is a global RaagaX editorial playlist.

-- 2. Add metadata to Playlist Songs
ALTER TABLE public.playlist_songs
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Enable RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

-- 4. Playlists Policies
-- Drop existing public read policy to replace it with more secure ones
DROP POLICY IF EXISTS "Allow public read access on playlists" ON public.playlists;

CREATE POLICY "Users can view their own playlists" 
ON public.playlists FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can view public playlists" 
ON public.playlists FOR SELECT 
USING (visibility = 'public');

CREATE POLICY "Anyone can view RaagaX global playlists" 
ON public.playlists FOR SELECT 
USING (owner_id IS NULL);

CREATE POLICY "Users can insert their own playlists" 
ON public.playlists FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own playlists" 
ON public.playlists FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own playlists" 
ON public.playlists FOR DELETE 
USING (auth.uid() = owner_id);

-- 5. Playlist Songs Policies
DROP POLICY IF EXISTS "Allow public read access on playlist_songs" ON public.playlist_songs;

CREATE POLICY "Users can view songs of playlists they can view" 
ON public.playlist_songs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_songs.playlist_id 
    AND (p.owner_id = auth.uid() OR p.visibility = 'public' OR p.owner_id IS NULL)
  )
);

CREATE POLICY "Users can add songs to their own playlists" 
ON public.playlist_songs FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_songs.playlist_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update songs in their own playlists" 
ON public.playlist_songs FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_songs.playlist_id 
    AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete songs from their own playlists" 
ON public.playlist_songs FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_songs.playlist_id 
    AND p.owner_id = auth.uid()
  )
);

-- Trigger to update `updated_at` on playlists
CREATE OR REPLACE FUNCTION update_playlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_playlists_timestamp ON public.playlists;
CREATE TRIGGER update_playlists_timestamp
    BEFORE UPDATE ON public.playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_playlists_updated_at();
