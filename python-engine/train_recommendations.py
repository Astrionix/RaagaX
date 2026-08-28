import os
import json
from datetime import datetime
import pandas as pd
import numpy as np
import scipy.sparse as sparse
from pathlib import Path

# Automatically load environment variables from .env.local if available
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

try:
    import implicit
    HAS_IMPLICIT = True
except ImportError:
    implicit = None
    HAS_IMPLICIT = False

from supabase import create_client, Client

# Initialize Supabase client
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Define weights for implicit feedback signals
ACTION_WEIGHTS = {
    'like': 20,
    'play': 10,
    'complete': 15,
    'replay': 12,
    'skip': -5
}

def fetch_data():
    """Fetch playback history and canonical songs from Supabase"""
    print("Fetching playback history...")
    
    # Filter to recent 90 days of history and paginate/limit safely
    history_res = (
        supabase.table('listening_events')
        .select('user_id, song_id, event_type, created_at')
        .order('created_at', desc=True)
        .limit(10000)
        .execute()
    )
    history_df = pd.DataFrame(history_res.data)
    
    if history_df.empty:
        print("No playback history found. Exiting.")
        return None, None
        
    print(f"Fetched {len(history_df)} interaction records.")
    
    # We also need song metadata to construct the final JSONB objects
    print("Fetching canonical songs metadata...")
    songs_res = supabase.table('canonical_songs').select('*').limit(5000).execute()
    songs_df = pd.DataFrame(songs_res.data)
    
    return history_df, songs_df

def map_song_to_json(song_row):
    """Maps a canonical_song row to a Next.js Song object"""
    audio_url = ""
    raw_data = song_row.get('raw_data')
    
    if raw_data and isinstance(raw_data, list) and len(raw_data) > 0:
        # Find 320kbps or fallback to highest available
        highest = next((d for d in raw_data if isinstance(d, dict) and d.get('quality') == '320kbps'), raw_data[-1])
        if isinstance(highest, dict):
            audio_url = highest.get('url', '')
    
    # Parse release year cleanly from year / release_date / created_at
    raw_year = song_row.get('year') or song_row.get('release_date') or song_row.get('release_year')
    release_year = None
    if raw_year:
        try:
            release_year = int(str(raw_year)[:4])
        except (ValueError, TypeError):
            pass
    if not release_year:
        release_year = datetime.now().year
        
    movie_name = song_row.get('movie_name') or song_row.get('album') or ''
    artist_name = song_row.get('artist', 'Unknown Artist')
    
    return {
        "id": song_row['id'],
        "title": song_row.get('title', 'Unknown Title'),
        "artist": artist_name,
        "artistId": song_row.get('artist_id') or song_row.get('artistId') or artist_name,
        "album": song_row.get('album', ''),
        "albumId": song_row.get('album_id') or song_row.get('albumId') or song_row.get('album', ''),
        "movie_name": movie_name,
        "coverUrl": song_row.get('cover_url') or song_row.get('coverUrl', ''),
        "audioUrl": audio_url,
        "duration": float(song_row.get('duration', 0) or 0),
        "genre": song_row.get('genre') or song_row.get('language', 'Telugu'),
        "language": song_row.get('language', 'Telugu'),
        "category": "ai_recommended",
        "releaseYear": release_year,
        "plays": int(song_row.get('plays', 0) or 0),
        "likes": int(song_row.get('likes', 0) or 0)
    }

def train_and_recommend():
    history_df, songs_df = fetch_data()
    if history_df is None or history_df.empty:
        return
        
    # Map actions to weights
    history_df['weight'] = history_df['event_type'].map(ACTION_WEIGHTS).fillna(0)
    
    # Aggregate weights (sum weights for the same user-song pair)
    grouped = history_df.groupby(['user_id', 'song_id'])['weight'].sum().reset_index()
    
    # Drop negative/zero aggregates (means they skipped more than played)
    grouped = grouped[grouped['weight'] > 0]
    
    # Create categorical IDs for sparse matrix
    grouped['user_idx'] = grouped['user_id'].astype('category').cat.codes
    grouped['song_idx'] = grouped['song_id'].astype('category').cat.codes
    
    user_cat = grouped['user_id'].astype('category').cat.categories
    song_cat = grouped['song_id'].astype('category').cat.categories
    
    # Create sparse matrix: Users x Items
    # Note: implicit expects Items x Users for fitting, but we will pass it as user_items
    sparse_user_item = sparse.csr_matrix(
        (grouped['weight'].astype(float), (grouped['user_idx'], grouped['song_idx']))
    )
    
    num_users, num_items = sparse_user_item.shape
    print(f"Matrix shape: {sparse_user_item.shape} (Users x Songs)")
    
    # Train Matrix Factorization Model (implicit ALS or scipy SVD fallback)
    if HAS_IMPLICIT and implicit is not None:
        try:
            print("Training Alternating Least Squares (ALS) model via implicit...")
            model = implicit.als.AlternatingLeastSquares(factors=min(32, num_items), regularization=0.1, iterations=15, calculate_training_loss=True)
            # implicit >= 0.5 takes user_items directly (users x items)
            try:
                model.fit(sparse_user_item)
            except Exception:
                model.fit(sparse_user_item.T)
        except Exception as e:
            print(f"Warning: implicit model failed ({e}), using SVD matrix factorization fallback.")
            model = None
    else:
        print("Note: implicit not installed, using high-performance scipy/numpy Truncated SVD matrix factorization...")
        model = None

    # Fallback to pure numpy/scipy SVD if implicit is unavailable
    if model is None:
        from scipy.sparse.linalg import svds
        k_factors = min(16, max(1, min(num_users - 1, num_items - 1)))
        if k_factors >= 1:
            u, s, vt = svds(sparse_user_item.astype(float), k=k_factors)
            pred_matrix = np.dot(np.dot(u, np.diag(s)), vt)
        else:
            pred_matrix = sparse_user_item.toarray()

    print("Generating recommendations for each user...")
    
    # Create a lookup dictionary for fast Song JSON mapping
    song_dict = {}
    if not songs_df.empty:
        for _, row in songs_df.iterrows():
            song_dict[row['id']] = map_song_to_json(row.to_dict())
            
    recommendations_to_insert = []
    
    # Generate recommendations for every user in the matrix
    for user_idx in range(num_users):
        user_uuid = user_cat[user_idx]
        
        # Get top N recommendations (fetch more to allow filtering)
        n_recs = min(100, num_items)
        if model is not None:
            try:
                rec_res = model.recommend(user_idx, sparse_user_item[user_idx], N=n_recs, filter_already_liked_items=False)
                recommended_indices = rec_res[0] if isinstance(rec_res, tuple) else rec_res
            except Exception:
                user_scores = sparse_user_item[user_idx].toarray().flatten()
                recommended_indices = np.argsort(-user_scores)[:n_recs]
        else:
            user_scores = pred_matrix[user_idx]
            recommended_indices = np.argsort(-user_scores)[:n_recs]
        
        all_recs = []
        seen = set()
        for idx in recommended_indices:
            song_id = song_cat[idx]
            if song_id in seen:
                continue
            seen.add(song_id)
            if song_id in song_dict:
                all_recs.append(song_dict[song_id])
                
        # Generate mixes based on the large pool of recommendations
        
        # 1. Daily Mix: Top 15 overall
        daily_mix = all_recs[:15]
        
        # 2. Release Radar: Recent releases (Release year >= current year - 1)
        current_year = datetime.now().year
        release_radar = [s for s in all_recs if s.get('releaseYear', 0) >= current_year - 1][:15]
        
        # 3. Artist Radars: Group by top 2 artists from user's history
        user_history = history_df[history_df['user_id'] == user_uuid]
        top_artists = user_history.groupby('artist')['weight'].sum().sort_values(ascending=False).head(2).index.tolist()
        
        artist_radars = {}
        for artist in top_artists:
            artist_songs = [s for s in all_recs if s.get('artist') == artist][:10]
            if artist_songs:
                artist_radars[artist] = artist_songs
                
        # 4. Daylist: Contextual based on time (mocked context logic for Phase 1)
        hour = datetime.now().hour
        daylist_title = "🌅 Morning Telugu" if hour < 12 else "🔥 Evening Telugu Energy" if hour < 18 else "🌙 Late Night Telugu"
        daylist_songs = all_recs[15:30] if len(all_recs) > 30 else all_recs
        
        # 5. New Movie Songs: Filter by movies
        movie_songs = [s for s in all_recs if s.get('movie_name')][:10]
        if not movie_songs:
            # Fallback if no movie data
            movie_songs = all_recs[5:15]
                
        mixes = {
            "daily_mix": daily_mix,
            "release_radar": release_radar,
            "artist_radars": artist_radars,
            "daylist": {
                "title": daylist_title,
                "songs": daylist_songs
            },
            "new_movie_songs": movie_songs
        }
                
        recommendations_to_insert.append({
            "user_id": user_uuid,
            "recommended_songs": daily_mix, # Keep for backwards compatibility
            "mixes": mixes,
            "generated_at": datetime.now().isoformat()
        })
        
    print(f"Upserting {len(recommendations_to_insert)} AI DJ profiles into Supabase...")
    
    # Batch upsert to ai_recommendations
    if recommendations_to_insert:
        supabase.table('ai_recommendations').upsert(recommendations_to_insert).execute()
        
    print("Successfully completed AI DJ matrix factorization cycle!")

if __name__ == "__main__":
    train_and_recommend()
