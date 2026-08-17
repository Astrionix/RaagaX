package com.raagax.music.data.db.dao;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Transaction;
import com.raagax.music.data.db.entity.PlaylistEntity;
import com.raagax.music.data.db.entity.PlaylistTrackCrossRef;
import com.raagax.music.data.db.entity.TrackEntity;
import java.util.List;

@Dao
public interface PlaylistDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertOrUpdatePlaylist(PlaylistEntity playlist);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertPlaylistTracks(List<PlaylistTrackCrossRef> crossRefs);

    @Query("SELECT * FROM playlists ORDER BY updatedAt DESC")
    List<PlaylistEntity> getAllPlaylists();

    @Query("SELECT * FROM playlists WHERE id = :playlistId LIMIT 1")
    PlaylistEntity getPlaylistById(String playlistId);

    @Query("SELECT t.* FROM tracks t INNER JOIN playlist_tracks pt ON t.id = pt.trackId WHERE pt.playlistId = :playlistId ORDER BY pt.position ASC")
    List<TrackEntity> getTracksForPlaylist(String playlistId);

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId AND trackId = :trackId")
    void removeTrackFromPlaylist(String playlistId, String trackId);

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :playlistId")
    void clearPlaylistTracks(String playlistId);

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    void deletePlaylist(String playlistId);
}
