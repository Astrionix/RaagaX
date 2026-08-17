package com.raagax.music.playback;

import com.raagax.music.data.model.MusicTrack;

public interface PlaybackListener {
    void onPlaybackStateChanged(PlaybackState state);
    void onTrackChanged(MusicTrack track);
    void onPositionDiscontinuity(long positionMs);
    void onPlaybackError(String errorMessage);
    void onTrackUnavailableOffline(MusicTrack track);
}
