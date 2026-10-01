import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function parseDurationToSeconds(durationText?: string): number {
  if (!durationText) return 0;
  const parts = durationText.trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

export function getOptimalArtwork(url?: string, sizePx: number = 720): string {
  if (!url) return "/placeholder-album.png";

  // 1. YouTube Google User Content & yt3.ggpht (avatar / channel / album art)
  if (url.includes("googleusercontent.com") || url.includes("yt3.ggpht.com")) {
    if (/=w\d+-h\d+/.test(url)) {
      return url.replace(/=w\d+-h\d+[^"]*/, `=w${sizePx}-h${sizePx}-l90-rj`);
    }
    if (/=s\d+/.test(url)) {
      return url.replace(/=s\d+[^"]*/, `=s${sizePx}-c`);
    }
    return `${url}=w${sizePx}-h${sizePx}-l90-rj`;
  }

  // 2. YouTube i.ytimg.com video thumbnails (hqdefault -> maxresdefault / sddefault)
  if (url.includes("ytimg.com") || url.includes("i.ytimg.com")) {
    // If requesting high resolution (>320px) and image is hqdefault / mqdefault / default
    if (sizePx >= 480) {
      if (url.includes("hqdefault.jpg")) {
        return url.replace("hqdefault.jpg", "maxresdefault.jpg");
      }
      if (url.includes("mqdefault.jpg")) {
        return url.replace("mqdefault.jpg", "maxresdefault.jpg");
      }
      if (url.includes("default.jpg") && !url.includes("maxresdefault.jpg") && !url.includes("sddefault.jpg")) {
        return url.replace("default.jpg", "maxresdefault.jpg");
      }
    }
    return url;
  }

  // 3. JioSaavn / Saavn CDN (150x150 -> 500x500 or 800x800)
  if (url.includes("saavncdn.com")) {
    return url.replace(/150x150/g, "500x500").replace(/50x50/g, "500x500");
  }

  // 4. Apple Music / iTunes Artwork
  if (url.includes("mzstatic.com")) {
    return url.replace(/\d+x\d+bb/g, `${sizePx}x${sizePx}bb`);
  }

  return url;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
