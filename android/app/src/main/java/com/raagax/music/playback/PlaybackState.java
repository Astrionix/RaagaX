package com.raagax.music.playback;

import com.raagax.music.data.model.MusicTrack;
import java.util.ArrayList;
import java.util.List;

public class PlaybackState {
    public enum State {
        IDLE,
        BUFFERING,
        PLAYING,
        PAUSED,
        ENDED,
        ERROR
    }

    public enum RepeatMode {
        OFF,
        ALL,
        ONE
    }

    public State state = State.IDLE;
    public MusicTrack currentTrack = null;
    public long currentPositionMs = 0;
    public long durationMs = 0;
    public long bufferedPositionMs = 0;
    public boolean isPlaying = false;
    public boolean isShuffleEnabled = false;
    public RepeatMode repeatMode = RepeatMode.OFF;
    public List<MusicTrack> queue = new ArrayList<>();
    public int currentQueueIndex = -1;
    public String errorMessage = null;

    public PlaybackState() {}

    public PlaybackState copy() {
        PlaybackState copy = new PlaybackState();
        copy.state = this.state;
        copy.currentTrack = this.currentTrack;
        copy.currentPositionMs = this.currentPositionMs;
        copy.durationMs = this.durationMs;
        copy.bufferedPositionMs = this.bufferedPositionMs;
        copy.isPlaying = this.isPlaying;
        copy.isShuffleEnabled = this.isShuffleEnabled;
        copy.repeatMode = this.repeatMode;
        copy.queue = new ArrayList<>(this.queue);
        copy.currentQueueIndex = this.currentQueueIndex;
        copy.errorMessage = this.errorMessage;
        return copy;
    }
}
