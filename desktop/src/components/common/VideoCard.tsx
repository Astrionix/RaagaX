"use client";

import { ShelfItem, Song } from "@/types/music";
import BaseCard from "./BaseCard";

interface VideoCardProps {
  item: ShelfItem;
  contextQueue?: Song[];
  shelfTitle?: string;
}

export default function VideoCard({ item, contextQueue, shelfTitle }: VideoCardProps) {
  return (
    <BaseCard
      item={item}
      variant="landscape"
      badge="Video"
      contextQueue={contextQueue}
      shelfTitle={shelfTitle || "YouTube Videos"}
    />
  );
}
