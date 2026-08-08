-- 1. Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Add an embedding column to canonical_songs. 
-- We use 1536 dimensions, which is standard for OpenAI's text-embedding-3-small and text-embedding-ada-002 models.
ALTER TABLE public.canonical_songs 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create an HNSW index for fast approximate nearest neighbor search
-- Note: Supabase recommends using HNSW over IVFFlat for better performance and recall
CREATE INDEX IF NOT EXISTS canonical_songs_embedding_idx 
ON public.canonical_songs 
USING hnsw (embedding vector_cosine_ops);

-- 4. Create a Postgres function to perform similarity search
-- This allows our Next.js API to quickly find songs that sound similar or have similar metadata.
CREATE OR REPLACE FUNCTION public.match_songs(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  exclude_ids text[] DEFAULT '{}'
)
RETURNS TABLE (
  id text,
  title text,
  artist text,
  album text,
  language text,
  cover_url text,
  duration int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.title,
    cs.artist,
    cs.album,
    cs.language,
    cs.cover_url,
    cs.duration,
    1 - (cs.embedding <=> query_embedding) AS similarity
  FROM public.canonical_songs cs
  WHERE cs.embedding IS NOT NULL
    AND cs.id != ALL(exclude_ids)
    AND 1 - (cs.embedding <=> query_embedding) > match_threshold
  ORDER BY cs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Helper RPC to match similar songs using a song ID directly
CREATE OR REPLACE FUNCTION public.match_similar_songs(
  target_song_id text,
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id text,
  title text,
  artist text,
  album text,
  language text,
  cover_url text,
  duration int,
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_embedding vector(1536);
BEGIN
  -- Get the embedding for the target song
  SELECT embedding INTO target_embedding
  FROM public.canonical_songs
  WHERE id = target_song_id;

  -- If it doesn't exist, return empty
  IF target_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.match_songs(
    target_embedding, 
    match_threshold, 
    match_count, 
    ARRAY[target_song_id]
  );
END;
$$;

