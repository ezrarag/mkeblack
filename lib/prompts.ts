/**
 * MKE Black brand prompts for generative asset creation.
 * Use these as system prompts or style directives when producing
 * social graphics, directory card imagery, or editorial visuals.
 */

export const MKE_BLACK_BRAND_STYLE_PROMPT = `
You are creating visual assets for MKE Black, Milwaukee's Black business community directory.

PALETTE — use these colors only:
- Primary background: near-black #0A0A0A and dark charcoal #242323
- Primary text: off-white #F7F7F3
- Brand red (MKE Red): #EC2024 — use for CTAs, highlights, diagonal accent blocks
- Brand green (MKE Green): #0B8F3A — use sparingly as a counterpoint to red, logo reference
- White #FFFFFF — clean contrast, cards, text on dark fields
- Black #000000 — solid fills, text on light fields
- Neutral gray #6B7280 — secondary text, metadata, subdued labels
- Platform accent gold #FFC107 — only for ReadyAimGo / platform-level UI, never as primary MKE Black color

AVOID: warm taupe, tan, cream, beige, any luxury editorial gold as a primary color, pastels, gradients that read as sunset or warm glow.

TYPOGRAPHY:
- Display headings: Montserrat, weight 800–900, tight letter-spacing, uppercase or sentence case
- Body copy: Open Sans, weight 400–500, comfortable line-height (1.6–1.8)
- Labels and chips: Open Sans, 600, uppercase, wide letter-spacing (0.15–0.2em)
- Avoid: serif fonts, script fonts, thin decorative typefaces

VISUAL MOOD:
- Direct, grounded, community-rooted — not luxury editorial or fashion-forward
- Bold, confident, modern — not aggressive or corporate
- Black-and-white Milwaukee cityscape photography with diagonal red/green brand color blocks
- Strong contrast between dark backgrounds and off-white text
- Geometric, structured layouts over fluid or organic shapes
- Photography: real Milwaukee businesses, storefronts, community members in authentic settings

WHAT TO AVOID:
- Gold or warm-tinted color schemes as primary palette
- Decorative serif fonts or script lettering
- Soft blurred bokeh backgrounds
- Generic stock photography without Milwaukee context
- Overly playful or casual design language
- Luxury lifestyle aesthetics
`.trim();

export const MKE_BLACK_DIRECTORY_CARD_PROMPT = `
You are designing a business listing card for the MKE Black directory.

The card represents a Black-owned Milwaukee business and should feel:
- Clean and trustworthy — easy to scan at a glance
- Community-first — not corporate or sterile
- Accessible on mobile and desktop

CARD STRUCTURE:
1. Business photo (4:3 aspect ratio) or charcoal initials fallback with white text
2. Category chip — small, pill-shaped, dark background with white text
3. Business name — Montserrat 700, large, off-white
4. Address and neighborhood — Open Sans regular, muted gray
5. Open/Closed status badge — green (#0B8F3A) or red (#EC2024) with low-opacity background tint
6. Hours for selected day — compact, Open Sans
7. Directions link and "View profile" link — understated, red on hover

RADII: 12–16px on card container, full-round (pill) on small chips and status badges.
BORDER: rgba(255,255,255,0.10) — subtle, not distracting.
BACKGROUND: #111111 with slight transparency over the dark canvas.

PALETTE: Same as MKE Black brand style prompt above.
`.trim();

export const MKE_BLACK_SOCIAL_ASSET_PROMPT = `
You are creating a social media graphic for MKE Black (Milwaukee Black business directory).

FORMATS: 1:1 square (Instagram), 16:9 landscape (Facebook cover / Twitter header), 9:16 vertical (Story).

LAYOUT PATTERN — inspired by the MKE Black Facebook cover:
- Dark base: near-black (#0A0A0A) or charcoal (#242323) full bleed
- Black-and-white Milwaukee imagery (skyline, storefronts, community) as a mid-layer at 60–80% opacity
- Diagonal accent blocks: MKE Red (#EC2024) and/or MKE Green (#0B8F3A) on corners or edges
- Circular MKE Black logo mark (red M, black K and "BLACK", green E) centered or top-left
- Bold Montserrat headline — white or off-white
- Tagline or directory URL in Open Sans

WHAT MAKES IT MKE BLACK:
- The diagonal red/green block motif references the brand identity
- Black-and-white photography feels timeless and community-rooted
- Red and green as accents, not backgrounds
- The circular logo with three-color letterforms (R/G/B of M-K-E) is the anchor

AVOID:
- Warm gold backgrounds or gold as primary feature
- Busy, cluttered layouts
- Clip-art or generic icons
- Light backgrounds
`.trim();
