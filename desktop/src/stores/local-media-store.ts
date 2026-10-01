import { create } from "zustand";
import { Song } from "@/types/music";

interface LocalMediaStore {
  localSongs: Song[];
  isScanning: boolean;
  addLocalFiles: (files: FileList | File[]) => Promise<void>;
  removeLocalSong: (videoId: string) => void;
  clearLocalSongs: () => void;
}

export const useLocalMediaStore = create<LocalMediaStore>((set, get) => ({
  localSongs: [],
  isScanning: false,

  addLocalFiles: async (files: FileList | File[]) => {
    set({ isScanning: true });
    const newSongs: Song[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|flac|wav|m4a|ogg|aac|opus)$/i)) {
        continue;
      }

      const blobUrl = URL.createObjectURL(file);
      const nameParts = file.name.replace(/\.[^/.]+$/, "").split(" - ");
      let artist = "Local Artist";
      let title = file.name.replace(/\.[^/.]+$/, "");

      if (nameParts.length >= 2) {
        artist = nameParts[0].trim();
        title = nameParts.slice(1).join(" - ").trim();
      }

      const extension = file.name.split(".").pop()?.toUpperCase() || "AUDIO";

      const song: Song = {
        videoId: `local-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        artist,
        albumName: "Local Device Audio",
        thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80",
        durationSeconds: 0,
        streamUrl: blobUrl,
        playbackSource: `Local (${extension})`,
      };

      // Probe audio duration
      try {
        const audio = new Audio(blobUrl);
        await new Promise((resolve) => {
          audio.onloadedmetadata = () => {
            song.durationSeconds = Math.round(audio.duration || 0);
            resolve(true);
          };
          audio.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 800);
        });
      } catch (_) {}

      newSongs.push(song);
    }

    set((state) => ({
      localSongs: [...newSongs, ...state.localSongs],
      isScanning: false,
    }));
  },

  removeLocalSong: (videoId: string) => {
    set((state) => ({
      localSongs: state.localSongs.filter((s) => s.videoId !== videoId),
    }));
  },

  clearLocalSongs: () => {
    get().localSongs.forEach((s) => {
      if (s.streamUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(s.streamUrl);
      }
    });
    set({ localSongs: [] });
  },
}));
