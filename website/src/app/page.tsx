import React from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { DownloadPanel } from "@/components/DownloadPanel";
import { ProductIntro } from "@/components/ProductIntro";
import { FeatureShowcase } from "@/components/FeatureShowcase";
import { ListenTogether } from "@/components/ListenTogether";
import { CrossDevice } from "@/components/CrossDevice";
import { Architecture } from "@/components/Architecture";
import { NativeAudio } from "@/components/NativeAudio";
import { BackendDeepDive } from "@/components/BackendDeepDive";
import { EngineeringDecisions } from "@/components/EngineeringDecisions";
import { ReliabilityTesting } from "@/components/ReliabilityTesting";
import { ProductScreens } from "@/components/ProductScreens";
import { TechStack } from "@/components/TechStack";
import { DevelopmentJourney } from "@/components/DevelopmentJourney";
import { WhatIBuilt } from "@/components/WhatIBuilt";
import { DownloadSection } from "@/components/DownloadSection";
import { SourceCode } from "@/components/SourceCode";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#04060a] text-zinc-100 flex flex-col selection:bg-red-500/30 selection:text-white">
      {/* Global Transparent / Frosted Navigation */}
      <Navbar />

      {/* Section 01: Hero Product Launch */}
      <Hero />

      {/* Primary APK Download Action Card */}
      <DownloadPanel />

      {/* Section 02: Product Introduction & Flow Composition */}
      <ProductIntro />

      {/* Section 03: Feature Showcase (5 Deep Visual Capabilities) */}
      <FeatureShowcase />

      {/* Section 04: Listen Together Distributed Systems Centerpiece */}
      <ListenTogether />

      {/* Section 05: Cross-Device Playback Specification */}
      <CrossDevice />

      {/* Section 06: Under the Interface System Architecture */}
      <Architecture />

      {/* Section 07: Native C++ Audio Engineering */}
      <NativeAudio />

      {/* Section 08: Go Jam Hub Backend Deep-Dive */}
      <BackendDeepDive />

      {/* Section 09: Engineering Decisions Editorial Cards */}
      <EngineeringDecisions />

      {/* Section 10: Reliability & Verified Test Suite Matrix */}
      <ReliabilityTesting />

      {/* Section 11: 10 Designed & Implemented Screens */}
      <ProductScreens />

      {/* Section 12: Production Technology Matrix */}
      <TechStack />

      {/* Section 13: Development Journey Milestones */}
      <DevelopmentJourney />

      {/* Section 14: What I Built (Authorship & Full-Stack Ownership) */}
      <WhatIBuilt />

      {/* Section 15: Download Experience Final CTA */}
      <DownloadSection />

      {/* Section 16: Source Code & GitHub Repository */}
      <SourceCode />

      {/* Footer & Disclaimer */}
      <Footer />
    </main>
  );
}
