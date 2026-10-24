"use client";

import React, { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Disc3 } from "lucide-react";
import { BEST_NEW_GROUPS, NEW_THIS_WEEK, RECENT_RELEASES, TrackItem, AlbumItem } from "@/data/discoveryData";

export const MusicDiscovery: React.FC = () => {
  const [activePreview, setActivePreview] = useState<string | null>("Weekend In Texas");
  const [bestNewGroups, setBestNewGroups] = useState<TrackItem[][]>(BEST_NEW_GROUPS);
  const [newThisWeek, setNewThisWeek] = useState<TrackItem[]>(NEW_THIS_WEEK);
  const [recentReleases, setRecentReleases] = useState<AlbumItem[]>(RECENT_RELEASES);

  const bestNewRef = useRef<HTMLUListElement>(null);
  const newThisWeekRef = useRef<HTMLUListElement>(null);
  const recentReleasesRef = useRef<HTMLUListElement>(null);

  // Auto-fetch daily global best songs and new songs with proper high-res covers
  React.useEffect(() => {
    fetch("/api/charts")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data.bestNewGroups?.length) {
          setBestNewGroups(data.bestNewGroups);
          if (data.newThisWeek?.length) {
            setNewThisWeek(data.newThisWeek);
          }
          if (data.recentReleases?.length) {
            setRecentReleases(data.recentReleases);
          }
        }
      })
      .catch((err) => {
        console.warn("Using offline curated catalog:", err.message);
      });
  }, []);

  const scrollContainer = (ref: React.RefObject<HTMLUListElement | null>, direction: "left" | "right") => {
    if (ref.current) {
      const scrollAmount = direction === "left" ? -400 : 400;
      ref.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const toggleTrack = (title: string) => {
    setActivePreview((prev) => (prev === title ? null : title));
  };

  return (
    <div id="music-discovery" className="relative mt-20 sm:mt-28 space-y-12">
      {/* SECTION HEADER */}
      <div className="page-container">
        <div className="flex items-center gap-2 mb-3">
          <div className="liquid-glass-pill inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono text-white/90">
            <Disc3 className="w-3.5 h-3.5 text-red-400" />
            <span>Lossless Streaming Catalog</span>
          </div>
        </div>
        <h2 className="text-[26px] sm:text-[36px] font-extrabold tracking-tight text-white">
          Curated Soundtracks &amp; Global Charts
        </h2>
        <p className="mt-1.5 text-sm sm:text-base text-white/50 max-w-2xl">
          Powered by high-bitrate FLAC and YouTube Music lossless audio pipelines with zero telemetry or tracking.
        </p>
      </div>

      {/* 1. BEST NEW SONGS */}
      <section className="relative pt-4">
        <div className="page-container flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h3 className="min-w-0 truncate text-[16px] sm:text-[18px] font-bold text-white tracking-tight">
              Best New Songs
            </h3>
            <span className="text-[11px] font-mono text-white/40 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
              Heavy Rotation
            </span>
          </div>

          <div className="-mr-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollContainer(bestNewRef, "left")}
              aria-label="Scroll Best New Songs left"
              className="liquid-glass-pill grid size-8 place-items-center rounded-full text-white/80 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollContainer(bestNewRef, "right")}
              aria-label="Scroll Best New Songs right"
              className="liquid-glass-pill grid size-8 place-items-center rounded-full text-white/80 hover:text-white cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* 3-Row Stacked Carousel */}
        <ul
          ref={bestNewRef}
          style={{
            paddingInline: "max(1.25rem, calc((100% - 1200px) / 2 + 1.25rem))",
            scrollPaddingInline: "max(1.25rem, calc((100% - 1200px) / 2 + 1.25rem))",
          }}
          className="no-scrollbar mt-3 flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 gap-3"
        >
          {bestNewGroups.map((group, colIdx) => (
            <li key={colIdx} className="w-[280px] sm:w-[310px] shrink-0 snap-start flex flex-col gap-2">
              {group.map((song, songIdx) => {
                const isPlaying = activePreview === song.title;
                return (
                  <div
                    key={songIdx}
                    onClick={() => toggleTrack(song.title)}
                    className={`btn-press group relative flex h-[62px] items-center gap-3 rounded-2xl px-3 cursor-pointer ${
                      isPlaying
                        ? "bg-white/[0.10] border border-red-500/40 shadow-[0_4px_20px_rgba(239,68,68,0.25),inset_0_1px_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md"
                        : "bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.16] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white/[0.04] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                      <img
                        alt={song.title}
                        src={song.cover}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {isPlaying && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-0.5 h-3 bg-red-400 animate-pulse" />
                            <span className="w-0.5 h-2 bg-red-400 animate-pulse delay-75" />
                            <span className="w-0.5 h-2.5 bg-red-400 animate-pulse delay-150" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-white/[0.08] pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium leading-[16px] text-white/90 group-hover:text-white">
                          {song.title}
                        </span>
                        {song.explicit && (
                          <span
                            role="img"
                            aria-label="Explicit"
                            title="Explicit"
                            className="inline-grid size-[13px] shrink-0 place-items-center rounded-[3px] bg-white/40 text-[8px] font-bold leading-none text-black"
                          >
                            E
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[12px] leading-[15px] text-white/50 group-hover:text-white/70">
                        {song.artist}
                      </p>
                    </div>

                    {/* Quick Play Trigger */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-1 text-white/70">
                      {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-white" />}
                    </div>
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      </section>

      {/* 2. NEW THIS WEEK */}
      <section className="relative pt-4">
        <div className="page-container flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h3 className="min-w-0 truncate text-[16px] sm:text-[18px] font-bold text-white tracking-tight">
              New This Week
            </h3>
            <span className="text-[11px] font-mono text-cyan-400/90 px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-500/20">
              Fresh Drops
            </span>
          </div>

          <div className="-mr-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollContainer(newThisWeekRef, "left")}
              aria-label="Scroll New This Week left"
              className="liquid-glass-pill grid size-8 place-items-center rounded-full text-white/80 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollContainer(newThisWeekRef, "right")}
              aria-label="Scroll New This Week right"
              className="liquid-glass-pill grid size-8 place-items-center rounded-full text-white/80 hover:text-white cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <ul
          ref={newThisWeekRef}
          style={{
            paddingInline: "max(1.25rem, calc((100% - 1200px) / 2 + 1.25rem))",
            scrollPaddingInline: "max(1.25rem, calc((100% - 1200px) / 2 + 1.25rem))",
          }}
          className="no-scrollbar mt-3 flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 gap-4 sm:gap-5"
        >
          {newThisWeek.map((album, i) => (
            <li key={i} className="w-36 sm:w-44 lg:w-48 shrink-0 snap-start">
              <div
                onClick={() => toggleTrack(album.title)}
                className="group block cursor-pointer focus-visible:outline-none"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.5)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)] after:transition-shadow after:duration-300 group-hover:after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">
                  <img
                    alt={album.title}
                    src={album.cover}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="size-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      {activePreview === album.title ? (
                        <Pause className="size-4 fill-black" />
                      ) : (
                        <Play className="size-4 fill-black translate-x-0.5" />
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-2.5 flex items-center gap-1.5 text-[13px] sm:text-[14px] font-semibold text-white tracking-tight">
                  <span className="truncate">{album.title}</span>
                  {album.explicit && (
                    <span
                      role="img"
                      aria-label="Explicit"
                      title="Explicit"
                      className="inline-grid size-[13px] shrink-0 place-items-center rounded-[3px] bg-white/40 text-[8px] font-bold leading-none text-black"
                    >
                      E
                    </span>
                  )}
                </p>
                <p className="truncate text-[12px] text-white/50 mt-0.5">{album.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. RECENT RELEASES */}
      <section className="relative pt-4">
        <div className="page-container flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h3 className="min-w-0 truncate text-[16px] sm:text-[18px] font-bold text-white tracking-tight">
              Recent Releases
            </h3>
            <span className="text-[11px] font-mono text-purple-400/90 px-2 py-0.5 rounded-full bg-purple-950/40 border border-purple-500/20">
              Studio Masters
            </span>
          </div>

          <div className="-mr-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollContainer(recentReleasesRef, "left")}
              aria-label="Scroll Recent Releases left"
              className="liquid-glass-pill grid size-8 place-items-center rounded-full text-white/80 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollContainer(recentReleasesRef, "right")}
              aria-label="Scroll Recent Releases right"
              className="liquid-glass-pill grid size-8 place-items-center rounded-full text-white/80 hover:text-white cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <ul
          ref={recentReleasesRef}
          style={{
            paddingInline: "max(1.25rem, calc((100% - 1200px) / 2 + 1.25rem))",
            scrollPaddingInline: "max(1.25rem, calc((100% - 1200px) / 2 + 1.25rem))",
          }}
          className="no-scrollbar mt-3 flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 gap-4 sm:gap-5"
        >
          {recentReleases.map((album, i) => (
            <li key={i} className="w-36 sm:w-44 lg:w-48 shrink-0 snap-start">
              <div
                onClick={() => toggleTrack(album.title)}
                className="group block cursor-pointer focus-visible:outline-none"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04] shadow-[0_8px_24px_rgba(0,0,0,0.5)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)] after:transition-shadow after:duration-300 group-hover:after:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.4)]">
                  <img
                    alt={album.title}
                    src={album.cover}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="size-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      {activePreview === album.title ? (
                        <Pause className="size-4 fill-black" />
                      ) : (
                        <Play className="size-4 fill-black translate-x-0.5" />
                      )}
                    </div>
                  </div>
                </div>

                <p className="mt-2.5 flex items-center gap-1.5 text-[13px] sm:text-[14px] font-semibold text-white tracking-tight">
                  <span className="truncate">{album.title}</span>
                  {album.explicit && (
                    <span
                      role="img"
                      aria-label="Explicit"
                      title="Explicit"
                      className="inline-grid size-[13px] shrink-0 place-items-center rounded-[3px] bg-white/40 text-[8px] font-bold leading-none text-black"
                    >
                      E
                    </span>
                  )}
                </p>
                <p className="truncate text-[12px] text-white/50 mt-0.5">{album.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
