import os
import json
from datetime import datetime
import pandas as pd
import numpy as np
import scipy.sparse as sparse
import implicit
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
    'skip': -5
}

def fetch_data():
    """Fetch playback history and canonical songs from Supabase"""
    print("Fetching playback history...")
    
    # In a real production app, you would paginate this or filter by date
    history_res = supabase.table('playback_history').select('*').execute()
    history_df = pd.DataFrame(history_res.data)
    
    if history_df.empty:
        print("No playback history found. Exiting.")
        return None, None
        
    print(f"Fetched {len(history_df)} interaction records.")
    
    # We also need song metadata to construct the final JSONB objects
    print("Fetching canonical songs metadata...")
    songs_res = supabase.table('canonical_songs').select('*').execute()
    songs_df = pd.DataFrame(songs_res.data)
    
    return history_df, songs_df

def map_song_to_json(song_row):
    """Maps a canonical_song row to a Next.js Song object"""
    audio_url = ""
    raw_data = song_row.get('raw_data')
    
    if raw_data and isinstance(raw_data, list):
        # Find 320kbps or fallback to highest available
        highest = next((d for d in raw_data if d.get('quality') == '320kbps'), raw_data[-1])
        audio_url = highest.get('url', '')
    
    return {
        "id": song_row['id'],
        "title": song_row['title'],
        "artist": song_row['artist'],
        "artistId": song_row['artist'],
        "album": song_row.get('album', ''),
        "albumId": song_row.get('album', ''),
        "coverUrl": song_row.get('cover_url', ''),
        "audioUrl": audio_url,
        "duration": float(song_row.get('duration', 0) or 0),
        "genre": song_row.get('language', 'Telugu'),
        "category": "ai_recommended",
        "releaseYear": datetime.now().year,
        "plays": 1000,
        "likes": 100
    }

def train_and_recommend():
    history_df, songs_df = fetch_data()
    if history_df is None or history_df.empty:
        return
        
    # Map actions to weights
    history_df['weight'] = history_df['action'].map(ACTION_WEIGHTS).fillna(0)
    
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
    
    print(f"Matrix shape: {sparse_user_item.shape} (Users x Songs)")
    
    # Initialize the ALS Model
    model = implicit.als.AlternatingLeastSquares(factors=32, regularization=0.1, iterations=15, calculate_training_loss=True)
    
    # Train the model (Implicit requires Item x User matrix)
    print("Training Alternating Least Squares (ALS) model...")
    model.fit(sparse_user_item.T)
    
    print("Generating recommendations for each user...")
    
    # Create a lookup dictionary for fast Song JSON mapping
    song_dict = {}
    if not songs_df.empty:
        for _, row in songs_df.iterrows():
            song_dict[row['id']] = map_song_to_json(row.to_dict())
            
    recommendations_to_insert = []
    
    # Generate recommendations for every user in the matrix
    num_users = sparse_user_item.shape[0]
    for user_idx in range(num_users):
        user_uuid = user_cat[user_idx]
        
        # Get top 15 recommendations
        # ids, scores = model.recommend(user_idx, sparse_user_item[user_idx], N=15)
        # Note: In implicit > 0.6.0, recommend returns a tuple of (indices, scores)
        recommended_indices, _ = model.recommend(user_idx, sparse_user_item[user_idx], N=15)
        
        user_recs = []
        for idx in recommended_indices:
            song_id = song_cat[idx]
            # Look up full song metadata
            if song_id in song_dict:
                user_recs.append(song_dict[song_id])
            else:
                # If we don't have canonical metadata (e.g. song was logged from local fallback)
                # Create a minimal object
                user_recs.append({
                    "id": song_id,
                    "title": "Unknown Track",
                    "artist": "Unknown Artist",
                    "coverUrl": "",
                    "audioUrl": "",
                    "duration": 0
                })
                
        recommendations_to_insert.append({
            "user_id": user_uuid,
            "recommended_songs": user_recs,
            "generated_at": datetime.now().isoformat()
        })
        
    print(f"Upserting {len(recommendations_to_insert)} AI DJ profiles into Supabase...")
    
    # Batch upsert to ai_recommendations
    if recommendations_to_insert:
        supabase.table('ai_recommendations').upsert(recommendations_to_insert).execute()
        
    print("Successfully completed AI DJ matrix factorization cycle!")

if __name__ == "__main__":
    train_and_recommend()
