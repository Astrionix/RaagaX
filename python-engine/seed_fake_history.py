import os
import random
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing env variables")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_data():
    print("Fetching users...")
    # Get all users using admin api
    users_res = supabase.auth.admin.list_users()
    users = users_res if isinstance(users_res, list) else getattr(users_res, 'users', [])
    
    if not users:
        print("No users found! Creating a dummy user automatically...")
        new_user = supabase.auth.admin.create_user({
            "email": "ai.tester@raagax.com",
            "password": "password123",
            "email_confirm": True
        })
        target_user = new_user.user.id
    else:
        target_user = users[0].id
    print(f"Targeting user: {target_user}")
    
    print("Fetching available songs...")
    songs_res = supabase.table('canonical_songs').select('id, title').limit(50).execute()
    songs = songs_res.data
    
    if not songs:
        print("No canonical songs found in database! The app needs to cache some songs first.")
        return
        
    for user in users:
        target_user = user.id if hasattr(user, 'id') else user['id']
        print(f"Injecting fake listening history for user {target_user}...")
        
        # Pick 15 random songs
        selected_songs = random.sample(songs, min(15, len(songs)))
        
        fake_events = []
        for song in selected_songs:
            r = random.random()
            if r > 0.9:
                event_type = 'like'
            elif r > 0.8:
                event_type = 'complete'
            elif r > 0.7:
                event_type = 'skip'
            else:
                event_type = 'play'
            fake_events.append({
                'user_id': target_user,
                'song_id': song['id'],
                'event_type': event_type,
                'position_ms': random.randint(10000, 200000)
            })
            
        supabase.table('listening_events').insert(fake_events).execute()
        
    print("Successfully injected fake listening events for all users!")
    print("You can now run train_recommendations.py to generate the AI DJ row!")

if __name__ == "__main__":
    seed_data()
