################################################################################
#
#   MKE BLACK — SEO & DISCOVERABILITY + "OUT OF BUSINESS" STATUS
#   Goal: when someone Googles "black owned restaurants milwaukee", a relevant
#   MKE Black directory/business page can surface and lead them to us.
#   Plus: a proper closed-business lifecycle distinct from generic inactive.
#
#   Run prompts in order. Stack: Next.js 14 App Router, Firebase/Firestore.
#   IMPORTANT context: business pages and the directory page are currently
#   CLIENT components ("use client") with NO server metadata. Google sees only
#   the global title/description from app/layout.tsx. This packet fixes that.
#
################################################################################


================================================================================
PROMPT SEO-1 — Per-business server metadata + structured data
Priority: HIGH — the single biggest SEO win
================================================================================

## The problem
app/business/[id]/page.tsx renders a client component with no generateMetadata,
so every business page shares the same generic <title>MKE Black</title>. Google
has nothing business-specific to index. We fix this WITHOUT rewriting the whole
page as a server component — we add a server-side metadata layer on top.

## Implementation

### 1. Add generateMetadata to app/business/[id]/page.tsx
Convert the file so the default export stays the same (renders the existing
client <BusinessProfilePage businessId={...} />), but ADD an async
generateMetadata that fetches the business server-side via Firebase Admin:

```ts
import type { Metadata } from "next";
import { getBusinessByIdAdmin } from "@/lib/firebase/admin-business";

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const business = await getBusinessByIdAdmin(params.id);
  if (!business || !business.active) {
    return { title: "Business not found | MKE Black" };
  }
  const title = `${business.name} — ${business.category} in Milwaukee | MKE Black`;
  const description = business.description?.slice(0, 155)
    || `${business.name} is a Black-owned ${business.category} in ${business.neighborhood || "Milwaukee"}. Find hours, location, and contact info on MKE Black.`;
  const image = business.photos?.[0];
  return {
    title,
    description,
    alternates: { canonical: `https://mkeblack.org/business/${business.id}` },
    openGraph: {
      title, description, url: `https://mkeblack.org/business/${business.id}`,
      images: image ? [{ url: image }] : undefined,
      type: "website"
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title, description, images: image ? [image] : undefined
    }
  };
}
```

### 2. Create lib/firebase/admin-business.ts
A server-only helper using firebase-admin (NOT the client SDK) to fetch a
single business doc + (optionally) a list of active businesses for the sitemap.
Reuse the existing admin init from wherever getFirebaseAdminDb lives.

### 3. JSON-LD structured data on the business page
Inside BusinessProfilePage (client is fine for this), inject a
<script type="application/ld+json"> with schema.org LocalBusiness:
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",     // or "Restaurant" when category is Food & Drink
  "name", "description", "image", "telephone", "url",
  "address": { "@type": "PostalAddress", "streetAddress", "addressLocality": "Milwaukee", "addressRegion": "WI" },
  "geo": { "@type": "GeoCoordinates", "latitude", "longitude" },
  "openingHoursSpecification": [ ...from business.hours... ],
  "areaServed": "Milwaukee, WI",
  "knowsAbout": ["Black-owned business"]
}
Map category → schema type where sensible (Food & Drink → Restaurant,
Hair/Beauty → HealthAndBeautyBusiness, else LocalBusiness).

## Result
Each business page now has a unique, keyword-rich title/description, social
share cards, and machine-readable LocalBusiness data Google can surface for
"black owned [category] milwaukee" queries.


================================================================================
PROMPT SEO-2 — SEO landing pages for category + "black-owned" intent
Priority: HIGH — captures the actual search phrases people type
================================================================================

## The problem
People Google "black owned restaurants milwaukee", "black owned hair salons
milwaukee", etc. We have /directory?tag=black-owned but query-string URLs are
weak SEO signals and don't render distinct indexable pages.

## Implementation

### 1. Create app/black-owned/[category]/page.tsx (server component)
A real, statically-generatable landing page per category:
- Route examples: /black-owned/restaurants, /black-owned/hair-salons,
  /black-owned/retail
- generateStaticParams returns the known category slugs.
- generateMetadata:
  title: "Black-Owned [Category] in Milwaukee | MKE Black"
  description: "Discover and support Black-owned [category] in Milwaukee. Browse
  [N] verified businesses with hours, locations, and reviews on MKE Black."
- The page server-fetches active businesses in that category (Firebase Admin),
  renders a heading ("Black-Owned Restaurants in Milwaukee"), an intro
  paragraph, and the list of businesses with links to each /business/[id].
- Include a clear CTA into the full /directory and a JSON-LD ItemList of the
  businesses.

### 2. Map friendly slugs → internal categories
restaurants → "Food & Drink", hair-salons → "Hair, Beauty & Grooming",
retail → "Retail & Shopping", health → "Health & Wellness", etc.
Keep a slug↔category map in lib/seo-categories.ts.

### 3. Cross-link
- Directory category chips link to the matching /black-owned/[category] page.
- Each landing page links back to /directory with the category preselected.

## Result
Indexable, content-rich pages that match real search phrases, each linking down
to individual business pages — the structure Google rewards.


================================================================================
PROMPT SEO-3 — Sitemap, robots, and homepage organization schema
Priority: MEDIUM — helps Google find and trust everything
================================================================================

### 1. app/sitemap.ts (Next.js native)
Dynamically generate a sitemap including: home, /directory, /news-articles,
/who-we-are, every /black-owned/[category] landing page, and every active
/business/[id] (fetch active business IDs via Firebase Admin). Set
changeFrequency + lastModified sensibly.

### 2. app/robots.ts
Allow all, point to https://mkeblack.org/sitemap.xml. Disallow /admin,
/dashboard, /api.

### 3. Organization + WebSite JSON-LD on the homepage
Add Organization schema (name MKE Black, logo, sameAs social links) and
WebSite schema with a SearchAction pointing at /directory?query={search_term}
so Google can show a sitelinks search box.

### 4. Set metadataBase in app/layout.tsx
export const metadata = { metadataBase: new URL("https://mkeblack.org"), ... }
so all relative OG image URLs resolve correctly.

## Note on the honest limits of SEO
Be clear with the client: this makes MKE Black ELIGIBLE to rank and gives Google
strong signals, but ranking for competitive terms also depends on domain age,
backlinks, and Google's index schedule. We control on-page SEO fully; we do not
control Google's ranking. Realistic timeline: weeks-to-months for new pages to
index and gain position. We can also submit the sitemap in Google Search Console
to accelerate indexing (a client setup step, document it).


================================================================================
PROMPT SEO-4 — "Out of business" / closed status lifecycle
Priority: MEDIUM — Rick asked; today closed == generic inactive (ambiguous)
================================================================================

## The problem
Today a business is just active:true/false. A permanently CLOSED business and a
temporarily hidden one are indistinguishable in the data, and the public report
flow ("Business has closed") already exists and writes to business_reports, but
there's no distinct closed STATUS, no public "Permanently closed" label, and no
one-click resolution beyond deactivate.

## Implementation

### 1. Add an operating status to Business (lib/types.ts)
Add: operatingStatus: "open" | "temporarily_closed" | "permanently_closed"
Default "open". Keep `active` as the visibility switch; operatingStatus is the
real-world state. A permanently_closed business can stay visible (greyed, with
a "Permanently closed" banner) OR be hidden — admin chooses.

### 2. Public business page
- If operatingStatus === "permanently_closed": show a clear red "Permanently
  closed" banner at top; suppress the "Open now/Closed" hours pill; keep the
  listing readable (history matters) unless admin hid it.
- If "temporarily_closed": amber "Temporarily closed" banner.
- Reflect this in JSON-LD too (LocalBusiness "openingHours" omitted; add a
  note). Google understands permanently_closed via the absence of hours + the
  on-page banner.

### 3. Admin reports queue (admin-reports-page.tsx)
For a report with reason "Business has closed", add a dedicated action:
"Mark permanently closed" → sets operatingStatus = "permanently_closed"
(and optionally active:false), resolves the report, writes an audit note.
Keep the existing "Deactivate" and "Dismiss" actions.

### 4. Admin business editor
Add an operatingStatus selector (Open / Temporarily closed / Permanently
closed) to the full edit form, separate from the active toggle, with helper
text explaining the difference.

### 5. Directory
By default the directory hides permanently_closed businesses from the main grid
(unless a "Show closed" toggle is on), but their /business/[id] page stays
reachable from search so a Google visitor who lands there sees the closed
banner rather than a 404.

## Firestore
No new collection — just the operatingStatus field on businesses. Update rules
only if you gate the field (admin/owner write, public read — same as other
business fields).


================================================================================
RUN ORDER
================================================================================
SEO-1  per-business metadata + JSON-LD     ← biggest win, do first
SEO-2  black-owned category landing pages  ← captures search phrases
SEO-3  sitemap + robots + org schema       ← helps indexing
SEO-4  closed-business lifecycle           ← Rick's ask, independent of SEO

After each: npx tsc --noEmit && npm run lint && npm run build
Post-deploy client step: submit sitemap in Google Search Console (document it
in the handoff packet).
################################################################################
