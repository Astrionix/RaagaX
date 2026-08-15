-- ============================================================================
-- MIGRATION 33: LIBRARY SYNC REALTIME PUBLICATION & AUTOMATIC REVISION TRIGGERS
-- Non-destructive, safe migration for Likes, Playlists, Playlist Songs & Favorites
-- ============================================================================

-- 1. Ensure user_library_state table exists with proper primary key & RLS
CREATE TABLE IF NOT EXISTS public.user_library_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_library_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own library state" ON public.user_library_state;
CREATE POLICY "Users access own library state"
ON public.user_library_state
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 1.1 Ensure liked_songs & playlists reference auth.users safely
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.liked_songs DROP CONSTRAINT IF EXISTS liked_songs_user_id_fkey;
    ALTER TABLE public.liked_songs ADD CONSTRAINT liked_songs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.playlists DROP CONSTRAINT IF EXISTS playlists_owner_id_fkey;
    ALTER TABLE public.playlists ADD CONSTRAINT playlists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 2. Ensure atomic increment_library_revision function exists
CREATE OR REPLACE FUNCTION increment_library_revision(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
    new_revision BIGINT;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN 0;
    END IF;

    INSERT INTO public.user_library_state (user_id, revision, updated_at)
    VALUES (p_user_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
    SET revision = user_library_state.revision + 1,
        updated_at = now()
    RETURNING revision INTO new_revision;
    
    RETURN new_revision;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger Function: Bumps library revision on direct user_id table changes (liked_songs, saved_albums, user_favorites)
CREATE OR REPLACE FUNCTION public.handle_user_library_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    IF v_user_id IS NOT NULL THEN
        PERFORM increment_library_revision(v_user_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger Function: Bumps library revision on playlist changes
CREATE OR REPLACE FUNCTION public.handle_playlist_change()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_owner_id := COALESCE(OLD.owner_id, (OLD.user_id)::uuid);
    ELSE
        v_owner_id := COALESCE(NEW.owner_id, (NEW.user_id)::uuid);
    END IF;

    IF v_owner_id IS NOT NULL THEN
        PERFORM increment_library_revision(v_owner_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger Function: Bumps library revision on playlist_songs changes
CREATE OR REPLACE FUNCTION public.handle_playlist_songs_change()
RETURNS TRIGGER AS $$
DECLARE
    v_playlist_id UUID;
    v_owner_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_playlist_id := OLD.playlist_id;
    ELSE
        v_playlist_id := NEW.playlist_id;
    END IF;

    -- Look up playlist owner
    IF v_playlist_id IS NOT NULL THEN
        SELECT COALESCE(owner_id, (user_id)::uuid) INTO v_owner_id
        FROM public.playlists
        WHERE id = v_playlist_id;

        IF v_owner_id IS NOT NULL THEN
            PERFORM increment_library_revision(v_owner_id);
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Triggers to Tables safely
DROP TRIGGER IF EXISTS trg_liked_songs_lib_rev ON public.liked_songs;
CREATE TRIGGER trg_liked_songs_lib_rev
AFTER INSERT OR DELETE ON public.liked_songs
FOR EACH ROW EXECUTE FUNCTION public.handle_user_library_change();

DROP TRIGGER IF EXISTS trg_playlists_lib_rev ON public.playlists;
CREATE TRIGGER trg_playlists_lib_rev
AFTER INSERT OR UPDATE OR DELETE ON public.playlists
FOR EACH ROW EXECUTE FUNCTION public.handle_playlist_change();

DROP TRIGGER IF EXISTS trg_playlist_songs_lib_rev ON public.playlist_songs;
CREATE TRIGGER trg_playlist_songs_lib_rev
AFTER INSERT OR UPDATE OR DELETE ON public.playlist_songs
FOR EACH ROW EXECUTE FUNCTION public.handle_playlist_songs_change();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_favorites') THEN
        DROP TRIGGER IF EXISTS trg_user_favorites_lib_rev ON public.user_favorites;
        CREATE TRIGGER trg_user_favorites_lib_rev
        AFTER INSERT OR DELETE ON public.user_favorites
        FOR EACH ROW EXECUTE FUNCTION public.handle_user_library_change();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_albums') THEN
        DROP TRIGGER IF EXISTS trg_saved_albums_lib_rev ON public.saved_albums;
        CREATE TRIGGER trg_saved_albums_lib_rev
        AFTER INSERT OR DELETE ON public.saved_albums
        FOR EACH ROW EXECUTE FUNCTION public.handle_user_library_change();
    END IF;
END $$;

-- 7. Enable REPLICA IDENTITY FULL on library tables for comprehensive Realtime payloads
DO $$
BEGIN
    ALTER TABLE public.liked_songs REPLICA IDENTITY FULL;
    ALTER TABLE public.playlists REPLICA IDENTITY FULL;
    ALTER TABLE public.playlist_songs REPLICA IDENTITY FULL;
    ALTER TABLE public.user_library_state REPLICA IDENTITY FULL;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_favorites') THEN
        ALTER TABLE public.user_favorites REPLICA IDENTITY FULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_albums') THEN
        ALTER TABLE public.saved_albums REPLICA IDENTITY FULL;
    END IF;
END $$;

-- 8. Add all library tables to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'liked_songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.liked_songs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playlists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'playlist_songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_songs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_library_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_library_state;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_albums') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'saved_albums') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_albums;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_favorites') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_favorites') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_favorites;
    END IF;
  END IF;
END $$;
