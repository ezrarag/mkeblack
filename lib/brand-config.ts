/**
 * MKE Black brand tokens — single source of truth for palette, typography,
 * spacing, and shadow values. Tailwind config and globals.css both derive
 * from these exports so changes ripple through the whole system.
 *
 * ReadyAimGo platform accent (gold) is intentionally kept separate and
 * secondary to the MKE Black red/green/black/white palette.
 */

// ─── Core Palette ────────────────────────────────────────────────────────────

export const mkeRed = "#EC2024";
export const mkeRedBright = "#FF4040";
export const mkeGreen = "#0B8F3A";
export const readyAimGoGold = "#FFC107";
export const readyAimGoGoldSoft = "#FFD54F";

export const brandBlack = "#000000";
export const brandCharcoal = "#EEF1EA";
export const brandCanvas = "#F6F7F2";
export const brandWhite = "#FFFFFF";
export const brandOffWhite = "#FAFAF6";
export const brandInk = "#161616";

// ─── Semantic Tokens (mapped to Tailwind color names) ────────────────────────

export const semanticTokens = {
  // Backgrounds
  canvas: brandCanvas,
  charcoal: brandCharcoal,
  panel: brandWhite,
  panelAlt: "#F0F3EC",

  // Typography
  ink: brandInk,
  muted: "#687166",

  // Primary interactive — MKE Red
  accent: mkeRed,
  accentSoft: mkeRedBright,

  // Borders (fixed opacity baked in)
  line: "rgba(22, 22, 22, 0.14)",

  // Status
  success: mkeGreen,
  danger: "#ef4444",
  info: "#3b82f6",
} as const;

// ─── Shadow Tokens ────────────────────────────────────────────────────────────

export const shadows = {
  glow: "0 22px 70px rgba(22, 22, 22, 0.10)",
} as const;

// ─── Background Image Tokens ──────────────────────────────────────────────────

export const backgroundImages = {
  /** Soft red/green dual-radial light gradient for section backgrounds */
  meshDark:
    "radial-gradient(circle at top left, rgba(236, 32, 36, 0.10), transparent 30%), " +
    "radial-gradient(circle at 85% 30%, rgba(11, 143, 58, 0.10), transparent 28%), " +
    "linear-gradient(180deg, rgba(250, 250, 246, 0.98), rgba(246, 247, 242, 1))",
} as const;

// ─── Typography Tokens ────────────────────────────────────────────────────────

export const typography = {
  fontDisplay: "var(--font-display)", // Montserrat — bold community-forward headings
  fontSans: "var(--font-sans)",       // Open Sans — readable body copy
} as const;

// ─── Radius Tokens ────────────────────────────────────────────────────────────

export const radius = {
  sm: "0.375rem",  // 6px — small chips, badges
  md: "0.5rem",    // 8px — inputs, inline elements
  lg: "0.75rem",   // 12px — cards, modals
  xl: "1rem",      // 16px — section containers
  pill: "9999px",  // full rounding — CTA buttons, day filters
} as const;

// ─── Full Consolidated Export ─────────────────────────────────────────────────

const brandConfig = {
  // Palette
  mkeRed,
  mkeRedBright,
  mkeGreen,
  readyAimGoGold,
  readyAimGoGoldSoft,
  brandBlack,
  brandCharcoal,
  brandCanvas,
  brandWhite,
  brandOffWhite,
  brandInk,

  // Semantic
  ...semanticTokens,

  // Shadows, backgrounds, type, radius
  shadows,
  backgroundImages,
  typography,
  radius,
} as const;

export default brandConfig;
