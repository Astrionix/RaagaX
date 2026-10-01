import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#FFFFFF",
        surface: {
          DEFAULT: "#0D0D0F",
          elevated: "#161618",
          card: "#1C1C1E",
          hover: "#252528",
          border: "#2C2C2E",
          borderLight: "#3A3A3C",
        },
        raaga: {
          red: "#FA2D48",
          redDark: "#D91B35",
          redGlow: "rgba(250, 45, 72, 0.35)",
          pink: "#FC3C63",
          purple: "#9D4EDD",
          blue: "#0A84FF",
          cyan: "#30D158",
        },
        muted: {
          DEFAULT: "#8E8E93",
          foreground: "#636366",
          dark: "#48484A",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 12s linear infinite",
        "mesh-wave": "meshWave 10s ease-in-out infinite alternate",
      },
      keyframes: {
        meshWave: {
          "0%": { transform: "scale(1) translate(0%, 0%)" },
          "50%": { transform: "scale(1.15) translate(-3%, 3%)" },
          "100%": { transform: "scale(1.05) translate(3%, -2%)" },
        },
      },
      boxShadow: {
        glow: "0 8px 32px 0 rgba(250, 45, 72, 0.25)",
        card: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
        player: "0 -4px 24px rgba(0, 0, 0, 0.75)",
      },
    },
  },
  plugins: [],
};

export default config;
