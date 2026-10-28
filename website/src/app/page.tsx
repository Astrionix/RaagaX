"use client";

import React from "react";
import { Hero } from "@/components/Hero";
import { IntegrationsRibbon } from "@/components/IntegrationsRibbon";
import { MusicDiscovery } from "@/components/MusicDiscovery";
import { BigScreenShowcase } from "@/components/BigScreenShowcase";
import { DownloadSection } from "@/components/DownloadSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#040507] text-zinc-100 flex flex-col selection:bg-red-500/30 selection:text-white">
      {/* 01: Centerpiece Hero with Mesh Drift Blobs & Live Synced Lyrics Player */}
      <Hero />

      {/* 03: Ecosystem & Compatibility Ribbon */}
      <IntegrationsRibbon />

      {/* 04: Curated Sounds & High-Res Music Discovery Carousel */}
      <MusicDiscovery />

      {/* 05: Big Screen Display & Compose Multiplatform Desktop Showcase */}
      <BigScreenShowcase />

      {/* 06: Final Closing CTA Experience */}
      <DownloadSection />

      {/* 07: Clean Minimalist Footer */}
      <Footer />
    </main>
  );
}
