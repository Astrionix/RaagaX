"use client";

import { ShelfItem } from "@/types/music";
import BaseCard from "./BaseCard";

interface PlaylistCardProps {
  item: ShelfItem;
}

export default function PlaylistCard({ item }: PlaylistCardProps) {
  const href = item.browseId ? `/playlist/${item.browseId}` : "#";

  return (
    <BaseCard
      item={item}
      variant="square"
      badge="Playlist"
      href={href}
      subtitlePrefix="YouTube"
    />
  );
}
