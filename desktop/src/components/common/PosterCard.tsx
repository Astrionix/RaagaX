"use client";

import { ShelfItem, Song } from "@/types/music";
import BaseCard from "./BaseCard";

interface PosterCardProps {
  item: ShelfItem;
  contextQueue?: Song[];
  shelfTitle?: string;
}

export default function PosterCard({ item, contextQueue, shelfTitle }: PosterCardProps) {
  const href = item.browseId
    ? item.type === "ARTIST"
      ? `/artist/${item.browseId}`
      : item.type === "ALBUM"
      ? `/album/${item.browseId}`
      : `/playlist/${item.browseId}`
    : undefined;

  return (
    <BaseCard
      item={item}
      variant="poster"
      badge="Spotlight"
      contextQueue={contextQueue}
      shelfTitle={shelfTitle || "Spotlight"}
      href={href}
    />
  );
}
