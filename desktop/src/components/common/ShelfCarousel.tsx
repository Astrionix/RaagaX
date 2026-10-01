"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { HomeShelf } from "@/types/music";
import SongCard from "./SongCard";

interface ShelfCarouselProps {
  shelf: HomeShelf;
  seeAllHref?: string;
  variant?: "square" | "landscape" | "poster";
}

export default function ShelfCarousel({
  shelf,
  seeAllHref,
  variant,
}: ShelfCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isVideoShelf =
    variant === "landscape" ||
    shelf.title.toLowerCase().includes("video") ||
    shelf.items?.some((i) => i.subtitle?.toLowerCase().includes("video"));

  const isPosterShelf = variant === "poster";

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -540 : 540;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!shelf.items || shelf.items.length === 0) return null;

  // Responsive card widths based on variant
  const cardWidthClass = isVideoShelf
    ? "w-[240px] sm:w-[280px] lg:w-[320px]"
    : isPosterShelf
    ? "w-[150px] sm:w-[170px] lg:w-[190px]"
    : "w-[160px] sm:w-[175px] lg:w-[195px] xl:w-[210px]";

  return (
    <section className="space-y-3 select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight">
            {shelf.title}
          </h3>
          {shelf.subtitle && (
            <p className="text-xs text-neutral-400 font-normal mt-0.5">
              {shelf.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              <span>See all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          {/* Scroll Arrows */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scroll("left")}
              className="p-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 text-neutral-400 hover:text-white transition shadow-sm"
              title="Scroll Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 text-neutral-400 hover:text-white transition shadow-sm"
              title="Scroll Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Adaptive Carousel */}
      <div
        ref={scrollRef}
        className="flex items-start gap-3.5 sm:gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth"
      >
        {shelf.items.map((item, idx) => (
          <div
            key={`${item.videoId || item.browseId}_${idx}`}
            className={`${cardWidthClass} shrink-0`}
          >
            <SongCard
              item={item}
              shelfTitle={shelf.title}
              variant={isVideoShelf ? "landscape" : isPosterShelf ? "poster" : "square"}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
