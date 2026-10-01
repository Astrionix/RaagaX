import { Song } from "@/types/music";
import { getOptimalArtwork } from "@/lib/utils";

export interface DiscordActivityPayload {
  details: string;
  state: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
}

class DiscordPresenceService {
  private lastSongId: string | null = null;
  private lastPlaying: boolean = false;
  private lastSpeed: number = 1.0;

  updatePresence(
    song: Song | null,
    isPlaying: boolean,
    currentTimeSeconds: number,
    durationSeconds: number,
    playbackSpeed: number = 1.0,
    options: {
      enabled?: boolean;
      showButtons?: boolean;
      showAudioQuality?: boolean;
    } = {}
  ) {
    if (options.enabled === false || !song || !isPlaying) {
      this.clearPresence();
      this.lastSongId = null;
      this.lastPlaying = false;
      return;
    }

    // Check if we need an update
    const nowMs = Date.now();
    const currentMs = currentTimeSeconds * 1000;
    const durationMs = durationSeconds * 1000;

    const adjustedPlaybackTime = Math.floor(currentMs / playbackSpeed);
    const calculatedStartTime = Math.floor((nowMs - adjustedPlaybackTime) / 1000);

    const remainingDuration = durationMs - currentMs;
    const adjustedRemainingDuration = Math.floor(remainingDuration / playbackSpeed);
    const calculatedEndTime = Math.floor((nowMs + adjustedRemainingDuration) / 1000);

    const titleWithRate =
      playbackSpeed !== 1.0
        ? `${song.title} [${playbackSpeed.toFixed(2)}x]`
        : song.title;

    const artworkUrl = getOptimalArtwork(song.thumbnailUrl, 512);

    const buttons =
      options.showButtons !== false
        ? [
            {
              label: "Listen on YouTube Music",
              url: `https://music.youtube.com/watch?v=${song.videoId}`,
            },
            {
              label: "Listen on Raaga",
              url: "https://github.com/chandu/raaga",
            },
          ]
        : undefined;

    const activity: DiscordActivityPayload = {
      details: titleWithRate,
      state: `by ${song.artist}`,
      timestamps:
        durationSeconds > 0
          ? {
              start: calculatedStartTime,
              end: calculatedEndTime,
            }
          : {
              start: calculatedStartTime,
            },
      assets: {
        large_image: artworkUrl,
        large_text: song.albumName || song.title,
        small_image: "raaga_logo",
        small_text: options.showAudioQuality
          ? "Hi-Res Lossless Audio · Raaga"
          : "Raaga Desktop",
      },
      buttons,
    };

    if (typeof window !== "undefined" && (window as any).electronAPI?.setDiscordActivity) {
      (window as any).electronAPI.setDiscordActivity(activity);
    }

    this.lastSongId = song.videoId;
    this.lastPlaying = isPlaying;
    this.lastSpeed = playbackSpeed;
  }

  clearPresence() {
    if (typeof window !== "undefined" && (window as any).electronAPI?.clearDiscordActivity) {
      (window as any).electronAPI.clearDiscordActivity();
    }
  }
}

export const discordPresence = new DiscordPresenceService();
