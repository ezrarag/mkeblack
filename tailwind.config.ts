import type { Config } from "tailwindcss";
import { semanticTokens, shadows, backgroundImages } from "./lib/brand-config";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: semanticTokens.canvas,
        charcoal: semanticTokens.charcoal,
        ink: semanticTokens.ink,
        accent: semanticTokens.accent,
        accentSoft: semanticTokens.accentSoft,
        panel: semanticTokens.panel,
        panelAlt: semanticTokens.panelAlt,
        muted: semanticTokens.muted,
        line: semanticTokens.line,
        success: semanticTokens.success,
        danger: semanticTokens.danger,
        info: semanticTokens.info,
      },
      boxShadow: {
        glow: shadows.glow,
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"]
      },
      backgroundImage: {
        "mesh-dark": backgroundImages.meshDark,
      }
    }
  },
  plugins: []
};

export default config;
