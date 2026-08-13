-- Migration 31: RaagaX Language Eligibility Schema & RPC Functions

-- 1. Table: user_language_affinity
CREATE TABLE IF NOT EXISTS user_language_affinity (
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    score INT DEFAULT 0,
    state VARCHAR(20) DEFAULT 'BLOCKED', -- 'BLOCKED', 'DISCOVERED', 'EXPLICIT', 'SELECTED', 'ACTIVE'
    search_count INT DEFAULT 0,
    play_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    playlist_add_count INT DEFAULT 0,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, language)
);

-- Enable RLS for user_language_affinity
ALTER TABLE user_language_affinity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own language affinity"
    ON user_language_affinity FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. RPC Function: update_user_language_score
CREATE OR REPLACE FUNCTION update_user_language_score(
    p_user_id UUID,
    p_language VARCHAR(50),
    p_weight INT,
    p_action VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_score INT := 0;
    v_new_score INT := 0;
    v_new_state VARCHAR(20) := 'BLOCKED';
    v_is_selected BOOLEAN := FALSE;
BEGIN
    -- Check if user explicitly selected this language in preferences
    SELECT EXISTS (
        SELECT 1 FROM user_languages
        WHERE user_id = p_user_id AND language = p_language
    ) INTO v_is_selected;

    -- Fetch current score
    SELECT score INTO v_current_score
    FROM user_language_affinity
    WHERE user_id = p_user_id AND language = p_language;

    IF v_current_score IS NULL THEN
        v_current_score := 0;
    END IF;

    v_new_score := GREATEST(0, v_current_score + p_weight);

    -- Calculate state based on score & selected status
    IF v_is_selected THEN
        v_new_state := 'ACTIVE';
    ELSIF p_action IN ('LIKE', 'ADD_TO_PLAYLIST', 'FOLLOW_ARTIST') OR v_new_score >= 15 THEN
        v_new_state := 'EXPLICIT';
    ELSIF v_new_score >= 5 THEN
        v_new_state := 'DISCOVERED';
    ELSE
        v_new_state := 'BLOCKED';
    END IF;

    -- Upsert record
    INSERT INTO user_language_affinity (
        user_id,
        language,
        score,
        state,
        search_count,
        play_count,
        like_count,
        playlist_add_count,
        last_interaction_at
    )
    VALUES (
        p_user_id,
        p_language,
        v_new_score,
        v_new_state,
        CASE WHEN p_action = 'SEARCH' THEN 1 ELSE 0 END,
        CASE WHEN p_action IN ('PLAY', 'PLAY_HALF', 'COMPLETE') THEN 1 ELSE 0 END,
        CASE WHEN p_action = 'LIKE' THEN 1 ELSE 0 END,
        CASE WHEN p_action = 'ADD_TO_PLAYLIST' THEN 1 ELSE 0 END,
        NOW()
    )
    ON CONFLICT (user_id, language) DO UPDATE SET
        score = EXCLUDED.score,
        state = EXCLUDED.state,
        search_count = user_language_affinity.search_count + EXCLUDED.search_count,
        play_count = user_language_affinity.play_count + EXCLUDED.play_count,
        like_count = user_language_affinity.like_count + EXCLUDED.like_count,
        playlist_add_count = user_language_affinity.playlist_add_count + EXCLUDED.playlist_add_count,
        last_interaction_at = NOW();
END;
$$;
