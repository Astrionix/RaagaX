package com.raagax.music.data.db.dao;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;
import com.raagax.music.data.db.entity.TrackEntity;
import java.util.List;

@Dao
public interface TrackDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertOrUpdate(TrackEntity track);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertAll(List<TrackEntity> tracks);

    @Query("SELECT * FROM tracks WHERE id = :trackId LIMIT 1")
    TrackEntity getTrackById(String trackId);

    @Query("SELECT * FROM tracks WHERE isLiked = 1 ORDER BY createdAt DESC")
    List<TrackEntity> getLikedTracks();

    @Query("SELECT * FROM tracks WHERE lastPlayedAt > 0 ORDER BY lastPlayedAt DESC LIMIT :limit")
    List<TrackEntity> getRecentlyPlayed(int limit);

    @Query("SELECT * FROM tracks WHERE title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' LIMIT :limit")
    List<TrackEntity> searchLocalTracks(String query, int limit);

    @Query("UPDATE tracks SET isLiked = :isLiked WHERE id = :trackId")
    void setLiked(String trackId, boolean isLiked);

    @Query("UPDATE tracks SET lastPlayedAt = :timestamp WHERE id = :trackId")
    void updateLastPlayed(String trackId, long timestamp);

    @Query("DELETE FROM tracks WHERE id = :trackId")
    void deleteTrack(String trackId);
}
