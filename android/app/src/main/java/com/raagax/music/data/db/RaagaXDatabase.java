package com.raagax.music.data.db;

import android.content.Context;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import com.raagax.music.data.db.dao.DownloadDao;
import com.raagax.music.data.db.dao.OutboxDao;
import com.raagax.music.data.db.dao.PlaylistDao;
import com.raagax.music.data.db.dao.TrackDao;
import com.raagax.music.data.db.entity.DownloadEntity;
import com.raagax.music.data.db.entity.OutboxEntity;
import com.raagax.music.data.db.entity.PlaylistEntity;
import com.raagax.music.data.db.entity.PlaylistTrackCrossRef;
import com.raagax.music.data.db.entity.TrackEntity;

@Database(
    entities = {
        TrackEntity.class,
        DownloadEntity.class,
        PlaylistEntity.class,
        PlaylistTrackCrossRef.class,
        OutboxEntity.class
    },
    version = 2,
    exportSchema = false
)
public abstract class RaagaXDatabase extends RoomDatabase {
    private static final String DATABASE_NAME = "raagax_native.db";
    private static volatile RaagaXDatabase INSTANCE;

    public abstract TrackDao trackDao();
    public abstract DownloadDao downloadDao();
    public abstract PlaylistDao playlistDao();
    public abstract OutboxDao outboxDao();

    public static RaagaXDatabase getInstance(Context context) {
        if (INSTANCE == null) {
            synchronized (RaagaXDatabase.class) {
                if (INSTANCE == null) {
                    INSTANCE = Room.databaseBuilder(
                        context.getApplicationContext(),
                        RaagaXDatabase.class,
                        DATABASE_NAME
                    )
                    .fallbackToDestructiveMigration()
                    .build();
                }
            }
        }
        return INSTANCE;
    }
}
