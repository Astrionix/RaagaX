-- ============================================================================
-- MIGRATION 40: Profiles Sync Columns & Automatic Signup Trigger
-- ============================================================================

-- 1. Add preferred_languages and music_interests columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_languages TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS music_interests TEXT[] DEFAULT '{}';

-- 1b. Add playable_url_expires_at column to canonical_songs for temporary stream caching
ALTER TABLE public.canonical_songs 
ADD COLUMN IF NOT EXISTS playable_url_expires_at TIMESTAMP WITH TIME ZONE;

-- 2. Create the auto-profile trigger function for user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        username, 
        display_name, 
        avatar_url, 
        preferred_language,
        onboarding_completed
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url',
        'te',
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
