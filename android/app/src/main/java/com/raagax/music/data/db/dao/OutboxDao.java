package com.raagax.music.data.db.dao;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import com.raagax.music.data.db.entity.OutboxEntity;
import java.util.List;

@Dao
public interface OutboxDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    long insertMutation(OutboxEntity mutation);

    @Query("SELECT * FROM outbox_sync WHERE status = 'PENDING' ORDER BY createdAt ASC")
    List<OutboxEntity> getPendingMutations();

    @Query("UPDATE outbox_sync SET status = :status, lastAttemptAt = :timestamp WHERE id = :id")
    void updateStatus(long id, String status, long timestamp);

    @Query("UPDATE outbox_sync SET retryCount = retryCount + 1, lastAttemptAt = :timestamp WHERE id = :id")
    void incrementRetry(long id, long timestamp);

    @Query("DELETE FROM outbox_sync WHERE id = :id")
    void deleteMutation(long id);

    @Query("DELETE FROM outbox_sync WHERE status = 'SYNCED'")
    void purgeSynced();
}
