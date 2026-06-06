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
        canvas: "rgb(var(--color-canvas-rgb) / <alpha-value>)",
        charcoal: "rgb(var(--color-charcoal-rgb) / <alpha-value>)",
        ink: "rgb(var(--color-ink-rgb) / <alpha-value>)",
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        accentSoft: "rgb(var(--color-accent-soft-rgb) / <alpha-value>)",
        panel: "rgb(var(--color-panel-rgb) / <alpha-value>)",
        panelAlt: "rgb(var(--color-panel-alt-rgb) / <alpha-value>)",
        muted: "rgb(var(--color-muted-rgb) / <alpha-value>)",
        line: "rgb(var(--color-line-rgb) / <alpha-value>)",
        success: "rgb(var(--color-success-rgb) / <alpha-value>)",
        danger: "rgb(var(--color-danger-rgb) / <alpha-value>)",
        info: "rgb(var(--color-info-rgb) / <alpha-value>)",
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"]
      },
      backgroundImage: {
        "mesh-dark": "var(--background-mesh-dark)",
      }
    }
  },
  plugins: []
};

export default config;
