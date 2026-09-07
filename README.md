# RaagaX - Futuristic Music Streaming Platform & API

A full-stack music streaming solution consisting of a high-performance **RaagaX Music API Engine**, a futuristic **RaagaX Music Web UI Application**, and native **Desktop & Mobile Apps** (macOS, Windows, Android).

## 📥 Download RaagaX

| Platform | Package | Architecture | Direct Download |
| :--- | :--- | :--- | :--- |
| 🍏 **macOS** | Universal DMG | Apple Silicon (M1/M2/M3/M4) & Intel (x64) | [**Download DMG (201 MB)**](https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-macOS-Universal.dmg) |
| 🪟 **Windows** | Universal Installer | Windows 10/11 (64-bit & 32-bit NSIS) | [**Download Installer (96 MB)**](https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-Windows-Universal.exe) |
| 🪟 **Windows** | Portable EXE | Windows 10/11 (Standalone, No Install) | [**Download Portable (96 MB)**](https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX-Windows-Portable.exe) |
| 📱 **Android** | Universal APK | Android 8.0+ (Phones & Tablets) | [**Download APK (13 MB)**](https://github.com/Astrionix/RaagaX/releases/download/v1.0.0/RaagaX.apk) |

> 🔗 **All Releases & Release Notes**: [GitHub Releases v1.0.0](https://github.com/Astrionix/RaagaX/releases/tag/v1.0.0)

## 📁 Repository Structure

```text
├── src/
│   ├── app/                         # 🎨 Next.js App Router (UI Pages & Layouts)
│   │   ├── api/[[...route]]/route.ts# ⚡ Embedded Hono API Catch-All Handler
│   │   ├── docs/page.tsx            # 📖 Redirects to Scalar API Documentation
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/                  # Player, 3D Visualizer, Views, Navigation UI
│   ├── context/                     # Zustand state management store
│   ├── lib/                         # realMusicEngine.ts, streamResolver.ts
│   ├── types/                       # TypeScript interfaces
│   │
│   ├── modules/                     # 🎵 Music API Modules (Search, Songs, Albums, Artists)
│   ├── common/                      # API Helpers, Constants, Models
│   └── api-app.ts                   # Hono OpenAPI App Configuration
│
├── package.json                     # 📦 Single Unified Package Dependencies & Scripts
├── next.config.mjs                  # Next.js Image & Domain Configuration
├── tailwind.config.js               # Styling Tokens
├── vercel.json                      # Zero-Config Vercel Deployment
└── vitest.config.ts                 # Vitest Unit Test Suite Configuration
```

## 🚀 Quick Start

```bash
npm run dev
```

* **Web UI Application**: `http://localhost:3000`
* **API Endpoints**: `http://localhost:3000/api/search/songs?query=Kesariya`
* **Interactive Scalar API Docs**: `http://localhost:3000/docs`

## 🧪 Unit Tests

```bash
npm test
```
