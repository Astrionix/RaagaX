package com.raagax.music.data.db.entity;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "outbox_sync")
public class OutboxEntity {
    @PrimaryKey(autoGenerate = true)
    public long id;

    @NonNull
    public String mutationType; // LIKE, UNLIKE, CREATE_PLAYLIST, DELETE_PLAYLIST, ADD_TRACK, REMOVE_TRACK

    @NonNull
    public String payloadJson;

    @NonNull
    public String status; // PENDING, SYNCING, FAILED

    public int retryCount;
    public long createdAt;
    public long lastAttemptAt;

    public OutboxEntity(@NonNull String mutationType, @NonNull String payloadJson) {
        this.mutationType = mutationType;
        this.payloadJson = payloadJson;
        this.status = "PENDING";
        this.retryCount = 0;
        this.createdAt = System.currentTimeMillis();
    }
}
