"use client";

import { ShelfItem, Song } from "@/types/music";
import ArtistCard from "./ArtistCard";
import VideoCard from "./VideoCard";
import AlbumCard from "./AlbumCard";
import PlaylistCard from "./PlaylistCard";
import BaseCard from "./BaseCard";

interface SongCardProps {
  item: ShelfItem;
  contextQueue?: Song[];
  shelfTitle?: string;
  variant?: "square" | "landscape" | "poster";
}

export default function SongCard({
  item,
  contextQueue,
  shelfTitle,
  variant,
}: SongCardProps) {
  // 1. Explicit or detected Artist
  if (item.type === "ARTIST" || item.browseId?.startsWith("UC")) {
    return <ArtistCard item={item} />;
  }

  // 2. Video Card
  if (variant === "landscape" || item.subtitle?.toLowerCase().includes("video")) {
    return (
      <VideoCard
        item={item}
        contextQueue={contextQueue}
        shelfTitle={shelfTitle}
      />
    );
  }

  // 3. Album Card
  if (item.type === "ALBUM" || item.browseId?.startsWith("MPRE")) {
    return <AlbumCard item={item} />;
  }

  // 4. Playlist Card
  if (
    item.type === "PLAYLIST" &&
    item.browseId &&
    (item.browseId.startsWith("VL") || item.browseId.startsWith("PL") || item.browseId.startsWith("RD"))
  ) {
    return <PlaylistCard item={item} />;
  }

  // 5. Default Song / Music Card
  return (
    <BaseCard
      item={item}
      variant={variant || "square"}
      contextQueue={contextQueue}
      shelfTitle={shelfTitle}
      href={item.browseId ? `/playlist/${item.browseId}` : undefined}
    />
  );
}
