"use client";

import { ShelfItem } from "@/types/music";
import BaseCard from "./BaseCard";

interface AlbumCardProps {
  item: ShelfItem;
}

export default function AlbumCard({ item }: AlbumCardProps) {
  const href = item.browseId ? `/album/${item.browseId}` : "#";

  return (
    <BaseCard
      item={item}
      variant="square"
      badge="Album"
      href={href}
    />
  );
}
