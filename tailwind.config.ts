import type { Config } from "tailwindcss";

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
        canvas: "#0a0a0a",
        ink: "#f6ead0",
        accent: "#D4A017",
        accentSoft: "#f0cd73",
        panel: "#111111",
        panelAlt: "#161616",
        muted: "#8a7c5c",
        line: "rgba(212, 160, 23, 0.16)",
        success: "#3ac779",
        danger: "#ef6351"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(212, 160, 23, 0.16)"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"]
      },
      backgroundImage: {
        "mesh-dark":
          "radial-gradient(circle at top left, rgba(212, 160, 23, 0.2), transparent 28%), radial-gradient(circle at 80% 20%, rgba(255, 214, 102, 0.12), transparent 22%), linear-gradient(180deg, rgba(19, 19, 19, 0.95), rgba(7, 7, 7, 1))"
      }
    }
  },
  plugins: []
};

export default config;
