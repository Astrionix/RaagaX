-- Add 'mixes' column to 'ai_recommendations' table to store categorized mixes
ALTER TABLE public.ai_recommendations
ADD COLUMN IF NOT EXISTS mixes JSONB DEFAULT '{}';

-- Allow NULL for recommended_songs in case we migrate fully to mixes
ALTER TABLE public.ai_recommendations
ALTER COLUMN recommended_songs DROP NOT NULL;
