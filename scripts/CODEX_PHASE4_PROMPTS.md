################################################################################
#                                                                              #
#   MKE BLACK — PHASE 4 CODEX PROMPTS                                         #
#   Source: "MKE Black App Phase 4 — Google Docs" (4-page spec)               #
#   Generated: April 2026                                                      #
#                                                                              #
#   GAP ANALYSIS — what the spec requires vs. what exists                      #
#                                                                              #
#   BUILT ✅:                                                                  #
#     - Business directory (listing, search, map, hours filter)                #
#     - Business owner dashboard (edit listing, photos, hours)                 #
#     - Tags/badges system (admin managed, owner selectable)                   #
#     - Neighborhood filter (Milwaukee GIS)                                    #
#     - Near Me (geolocation sort)                                             #
#     - Admin CMS (homepage modules, member discounts)                         #
#     - CSV import (Wix migration)                                             #
#     - Claim flow (admin invite + self-claim)                                 #
#     - Admin team provisioning                                                #
#     - Firestore rules (all collections)                                      #
#     - Hours sync (Google Places API)                                         #
#                                                                              #
#   QUEUED (in ALL_CODEX_PROMPTS.md, prompts 2–12):                           #
#     - Stripe membership portal (Solidarity Circle)                           #
#     - Consumer favorites + reviews                                           #
#     - Events collection                                                      #
#     - Google Workspace admin                                                 #
#     - Business owner profile + team section                                  #
#     - Professionals directory                                                #
#                                                                              #
#   GAPS FROM PHASE 4 SPEC — addressed in THIS file:                          #
#     P4-1: Solidarity Circle member badge + search priority                   #
#     P4-2: "Now Open" live filter                                             #
#     P4-3: List View / Map View toggle                                        #
#     P4-4: Business page full spec (delivery links, products,                 #
#            anonymous feedback, awards, founded year, social media)            #
#     P4-5: Marketplace (member-only, products, Black Dollars)                 #
#     P4-6: Jobs Board                                                         #
#     P4-7: Survival Map                                                       #
#     P4-8: Monetization (sponsored search, in-app ads, city licensing)        #
#     P4-9: MKE Black Professionals (full spec from doc)                       #
#                                                                              #
#   HOW TO USE                                                                 #
#   Copy ONE prompt section at a time into Codex.                              #
#   Run in order P4-1 through P4-9.                                            #
#   Always end with: npx tsc --noEmit && npm run lint && npm run build         #
#                                                                              #
################################################################################


================================================================================
PROMPT P4-1 — Solidarity Circle Badge + Search Priority
Repo: ezrarag/mkeblack
Priority: HIGH — core monetization driver, mentioned 6x in spec
Depends on: Prompt 2 (Stripe membership) being complete
================================================================================

Add Solidarity Circle membership status to the business directory.
Solidarity Circle members (paid Stripe membership) get:
1. A visual badge on their listing
2. Automatic placement FIRST in all search and filter results
3. Access to Marketplace and Jobs Board features

## New field on Business (lib/types.ts)
solidarityMember: boolean;
solidarityMemberSince: Date | null;
solidarityMemberExpiry: Date | null;

## Firestore: where solidarityMember comes from
When a membership Stripe webhook fires (checkout.session.completed)
AND the member has a businessId linked to their account:
- Set businesses/{businessId}.solidarityMember = true
- Set solidarityMemberSince = now
- Set solidarityMemberExpiry = subscription period end

When subscription is cancelled/expired:
- Set solidarityMember = false via webhook handler

## Directory search priority
In useBusinesses hook and all directory filter functions:
- Sort: solidarityMember === true businesses ALWAYS come first
- Within solidarity members: sort by name A–Z
- Within non-members: sort by name A–Z (or distance if Near Me active)
- When sorted by "Most Favorited": solidarity members still lead tier

## Visual badge: "Solidarity Circle"
On business card in directory:
- Gold star + "Solidarity Circle" badge, top-left of card
- Style: small pill, gold background, dark text, 11px

On business profile page:
- Larger badge below business name
- "Proud member of the MKE Black Solidarity Circle"

## Admin controls
In /admin/businesses/[id]:
- Toggle solidarityMember on/off manually
- Set expiry date manually (for comped memberships)
- View membership since date

## Directory filter UI addition
Add "Solidarity Circle Members" as a quick filter chip
above the main filter bar. When active, shows only
solidarity member businesses.

## Firestore rules addition
match /businesses/{businessId} {
  // solidarityMember can only be set by admin or via webhook (server-side)
  // Owners cannot set their own solidarityMember field
}

## Seed update
In scripts/seed-firestore.js: add solidarityMember: false to
the createEmptyBusinessForm defaults so all imported businesses
start as non-members.


================================================================================
PROMPT P4-2 — "Now Open" Live Filter
Repo: ezrarag/mkeblack
Priority: HIGH — #1 requested feature from user research
Depends on: hours data being populated (hours sync prompt 9)
================================================================================

Add a "Now Open" filter to the business directory that shows only
businesses currently open based on their structured hours.

## New utility: lib/business-hours.ts additions

Add to existing business-hours.ts:

```typescript
// Returns true if a business is currently open
// Uses the browser's local time (Milwaukee visitors are local)
export function isOpenNow(hours: BusinessHours): boolean {
  const now = new Date();
  // Map JS getDay() (0=Sun) to our DayKey
  const dayMap: Record<number, DayKey> = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday"
  };
  const todayKey = dayMap[now.getDay()];
  const todayHours = hours[todayKey];

  if (!todayHours || todayHours.closed) return false;

  const [openH, openM] = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Handle overnight hours (close < open means they close after midnight)
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// Returns a status string for display
export function getOpenStatus(hours: BusinessHours): {
  open: boolean;
  label: string;  // "Open now", "Closed", "Opens at 9am", "Closes at 5pm"
} { ... }
```

## Directory filter
Add "Now Open" toggle button to filter bar.
When active:
- Filter filteredBusinesses to only businesses where isOpenNow(b.hours) === true
- Show count: "14 open now"
- Button shows green dot + "Now Open"
- Solidarity Circle members who are open come first

## Business card
Add open/closed status indicator:
- Green dot + "Open now" OR Red dot + "Closed"
- Shown on hover on desktop, always visible on mobile
- If hours not set (all closed: true): show "Hours not listed"

## Map popup
Already spec'd in Prompt 8 (map improvements).
Confirm isOpenNow is used in popup content.

## Business profile page
- Show open/closed status prominently below business name
- Show full today's hours: "Open today 9am – 5pm"
- Show "Opens [day] at [time]" if currently closed

## Auto-refresh
useEffect that recalculates "Now Open" filter every 5 minutes
so the filter stays accurate as time passes.


================================================================================
PROMPT P4-3 — List View / Map View Toggle
Repo: ezrarag/mkeblack
Priority: MEDIUM — spec explicitly calls for both views
================================================================================

Add a persistent List View / Map View toggle to the directory.
The spec calls for both views as a named feature.

## Current state
Directory shows card grid with map alongside (from Prompt 8).
This prompt makes the toggle explicit and persistent.

## Toggle UI
Add to directory filter bar, right-aligned:
[ ≡ List ] [ ⊞ Map ] — styled as segmented control

## List view
- Card grid as currently implemented
- On mobile: single column
- On desktop: 2–3 column grid
- When "Now Open" active + solidarity members first: list order reflects this

## Map view (full)
- Map takes full width of content area (not split)
- Business cards appear as a horizontal scrollable strip at the bottom
  (similar to Google Maps mobile: cards peek up from bottom, scroll sideways)
- Clicking a pin scrolls to that card in the strip
- Clicking a card flies map to that pin
- "List view" button in top-left of map

## Preference persistence
Save chosen view to localStorage key "mkeblack-directory-view"
so returning visitors see their preferred view.

## Mobile behavior
- Default: List view (cards are easier to browse on small screens)
- "Map" tab in filter bar switches to full-width map with bottom card strip
- No split view on mobile (too cramped)

## Desktop behavior
- Default: split view (55% list / 45% map) from Prompt 8
- "Map" toggle: full-width map + bottom strip
- "List" toggle: full-width list, map hidden


================================================================================
PROMPT P4-4 — Business Profile Page Full Spec
Repo: ezrarag/mkeblack
Priority: HIGH — many fields in spec not yet on the business page
================================================================================

Expand the public business profile page (/business/[id]) to match
the full Phase 4 spec.

## Fields to add to Business type (lib/types.ts)
yearFounded: number | null;
socialMedia: {
  instagram: string;
  facebook: string;
  twitter: string;
  tiktok: string;
  youtube: string;
} | null;
deliveryLinks: {
  label: string;  // "DoorDash", "Uber Eats", "GrubHub", "Instacart"
  url: string;
}[];
awardsAndCommendations: string[];  // free text list
causesSupporting: string[];        // org names or URLs
anonymousFeedbackEnabled: boolean;

## Business profile page sections (in order)

### 1. Hero section (exists, expand)
- Business name + Solidarity Circle badge if member
- Category badge + tags/badges (from existing tags system)
- Year founded: "Est. 2018"
- Open/closed status (from P4-2)
- Distance to user (if geolocation active from P4 Near Me)

### 2. Contact & links (expand existing)
- Phone, website, email (existing)
- Social media icons: Instagram, Facebook, Twitter/X, TikTok, YouTube
  Each only shown if URL is set
- "Get Directions" → Google Maps deep link
  URL: https://www.google.com/maps/dir/?api=1&destination={encoded address}
- Delivery service links (new):
  DoorDash | Uber Eats | GrubHub | Instacart
  Only shown if links are set. Admin/owner can add these.

### 3. About (narrative — existing, keep)

### 4. Hours (existing, expand)
- Full week hours table
- Highlight today's row
- "Now open" / "Closed" live status

### 5. Products & Menu (new section)
- Only shown if business has products listed
- For food: "Menu" heading
- For non-food: "Products & Services" heading
- Grid of product cards: photo, name, price
- "Order online" button linking to delivery service if available
- Phase 1: admin/owner enters products manually
  (Marketplace integration comes in P4-5)

### 6. Photos (existing, keep)
- Gallery grid, click to lightbox

### 7. Owner & Team (from Prompt 10 — confirm wired here)

### 8. Awards & Commendations (new)
- Only shown if list is non-empty
- Simple bulleted list with trophy icon

### 9. Causes Supporting (new)
- Only shown if list is non-empty
- Text list of causes/orgs the business supports

### 10. Anonymous Feedback (new)
- "Share feedback about this business" link
- Opens a modal form: rating (1–5 stars) + optional text comment
- "Anonymous" — no name required, just submits to
  businesses/{id}/anonymous_feedback subcollection
  { rating, text, submittedAt }
- Admin can view in /admin/businesses/[id]
- Different from reviews (which are public and attributed)

### 11. Reviews (from Prompt 4 — confirm wired here)

## Owner dashboard — new fields
Add to business editor form (for owner):
- Social media URLs (5 fields)
- Year founded
- Delivery service links (add/remove)
- Causes supporting (add/remove text items)
- Awards (add/remove text items)
- Anonymous feedback toggle

## Firestore rules additions
match /businesses/{businessId}/anonymous_feedback/{feedbackId} {
  allow create: if true;  // anyone can submit anonymously
  allow read: if isAdmin() || ownsBusiness();
  allow delete: if isAdmin();
}


================================================================================
PROMPT P4-5 — Marketplace
Repo: ezrarag/mkeblack
Priority: MEDIUM — Solidarity Circle member only, monetization
Depends on: P4-1 (Solidarity Circle badge), Prompt 2 (Stripe membership)
================================================================================

Add a marketplace where Solidarity Circle member businesses can post
products and services for online ordering.

## Firestore Collection: marketplace_listings
{
  id: string,
  businessId: string,
  businessName: string,          // denormalized for display
  solidarityMember: boolean,     // must be true to list
  name: string,
  description: string,
  price: number,                 // in cents
  photoUrl: string,
  category: string,              // "Food", "Service", "Product", "Digital"
  available: boolean,
  featured: boolean,             // admin can feature items
  orderUrl: string | null,       // external order link (Phase 1: link out)
  blackDollarsAccepted: boolean, // "Transact in Black Dollars" flag
  createdAt: timestamp,
  updatedAt: timestamp
}

## Firestore Collection: marketplace_orders (Phase 2, stub for now)
{
  id: string,
  listingId: string,
  buyerUid: string,
  businessId: string,
  quantity: number,
  totalCents: number,
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled',
  createdAt: timestamp
}

## Public page: /marketplace
- Header: "Black Marketplace — shop Black-owned"
- Solidarity Circle member badge + note: "All sellers are verified MKE Black members"
- Filter: category | price range | available now | Black Dollars accepted
- Product cards: photo, name, business name, price, "Order" button
- "Order" button Phase 1: links to business website or orderUrl
- Sorting: featured first, then newest

## Business dashboard — Marketplace tab
- Only visible if solidarityMember === true
- "Your listings" table: name, price, available toggle, edit/delete
- "Add listing" button → form: name, description, price, photo, category,
  available toggle, order URL, Black Dollars toggle

## Admin: /admin/marketplace
- All listings across all businesses
- Feature/unfeature listings
- Deactivate any listing
- Filter by business, category, price

## Homepage module: 'marketplace'
Add 'marketplace' as a valid HomepageModuleType.
Shows 4 featured marketplace listings as cards.
Admin toggles on/off from /admin/homepage.

## Black Dollars note
"Transact in Black Dollars" flag is a display indicator for Phase 1.
Phase 2: integrate with a Black-owned payment processor or
create a BEAM Coin redemption path. For now, flag means the
business accepts some form of community currency — display only.

## Firestore rules
match /marketplace_listings/{listingId} {
  allow read: if resource.data.available == true || isAdmin() || ownsBusiness();
  allow create: if isAdmin() || ownsBusiness();
  allow update: if isAdmin() || ownsBusiness();
  allow delete: if isAdmin();
}


================================================================================
PROMPT P4-6 — Jobs Board
Repo: ezrarag/mkeblack
Priority: MEDIUM — Solidarity Circle member only feature
Depends on: P4-1 (Solidarity Circle), Prompt 2 (Stripe)
================================================================================

Add a jobs board for MKE Black businesses to post opportunities
and for community members to find work.

## Firestore Collection: job_listings
{
  id: string,
  businessId: string,
  businessName: string,
  solidarityMemberOnly: boolean,  // whether posting requires membership
  title: string,
  description: string,
  type: 'full-time' | 'part-time' | 'contract' | 'volunteer' | 'internship',
  pay: string,                    // free text: "$15/hr", "Salary DOE", "Volunteer"
  location: 'in-person' | 'remote' | 'hybrid',
  neighborhood: string | null,
  applicationUrl: string,         // link to apply
  applicationEmail: string,       // email to apply
  deadline: timestamp | null,
  active: boolean,
  featured: boolean,
  createdAt: timestamp
}

## Firestore Collection: training_resources (admin controlled)
{
  id: string,
  title: string,
  organization: string,
  description: string,
  url: string,
  type: 'training' | 'certification' | 'apprenticeship' | 'grant',
  deadline: string | null,
  free: boolean,
  active: boolean,
  order: number
}

## Public page: /jobs
Two tabs: "Job Openings" | "Training & Resources"

### Job Openings tab
- Filter: type (full-time/part-time/etc.) | location | neighborhood
- Job cards: title, business name + logo, type badge, pay, location, deadline
- "Apply" button → applicationUrl or mailto:applicationEmail
- Solidarity Circle member businesses highlighted with badge

### Training & Resources tab (admin-controlled)
- Grid of resource cards: org name, title, type badge, free badge, deadline
- Link to external resource URL
- Admins manage from /admin/jobs/resources

## Business dashboard — Jobs tab
- Only visible if solidarityMember === true (per spec)
- "Your job listings" list with active toggle, edit, delete
- "Post a job" form: title, description, type, pay, location,
  neighborhood, application URL or email, deadline

## Admin: /admin/jobs
- All job listings: title, business, type, active toggle, feature toggle
- Training resources: add/edit/delete/reorder
- Filter by business, type, active status

## Homepage module: 'jobs'
Add 'jobs' as HomepageModuleType.
Shows 3 recent job listings + link to /jobs.

## Firestore rules
match /job_listings/{listingId} {
  allow read: if resource.data.active == true || isAdmin() || ownsBusiness();
  allow create, update: if isAdmin() || ownsBusiness();
  allow delete: if isAdmin();
}
match /training_resources/{resourceId} {
  allow read: if resource.data.active == true || isAdmin();
  allow write: if isAdmin();
}


================================================================================
PROMPT P4-7 — Survival Map
Repo: ezrarag/mkeblack
Priority: MEDIUM — Solidarity Circle member access per spec
Note: The spec says "Solidarity Circle Member Only Option" for Survival.
      However this is a community safety resource — discuss with Rick/Solana
      whether it should be public or member-only. Implement as toggleable.
================================================================================

Add a "Survival" map showing community resource locations in Milwaukee.

## Firestore Collection: survival_resources
{
  id: string,
  name: string,
  type: 'food_pantry' | 'fruit_tree' | 'water' | 'phone_charging'
       | 'clothing_bank' | 'shelter' | 'other',
  address: string,
  description: string,
  hours: string,            // free text, e.g. "Mon-Fri 9am-5pm"
  phone: string,
  website: string,
  location: { lat: number, lng: number },
  memberOnly: boolean,      // per spec, but togglable
  active: boolean,
  verifiedAt: timestamp | null,
  addedAt: timestamp
}

## Public page: /survival
- Header: "Community Resources — Milwaukee"
- Member-only gate: if memberOnly resources require login check
  (check users/{uid} for Solidarity membership)
- Full-width Mapbox map showing resource pins
- Color-coded by type:
  🟢 Food Pantry | 🔵 Water | 🟡 Phone Charging
  🟠 Clothing Bank | 🔴 Shelter | 🌳 Fruit Tree
- Filter chips: show/hide each resource type
- Resource list below map (or sidebar on desktop):
  Name, type badge, address, hours, phone
- "Get Directions" button per resource

## Admin: /admin/survival
- Table of all resources with: name, type, address, active toggle
- "Add resource" button → form: all fields + map pin placement
  (drag pin to set lat/lng, or geocode from address)
- Edit / deactivate any resource
- "Verify" button + verifiedAt timestamp

## Homepage module: 'survival'
Add 'survival' as HomepageModuleType.
When visible, shows a preview map with resource count by type.
Admin toggles visibility from /admin/homepage.

## Firestore rules
match /survival_resources/{resourceId} {
  allow read: if resource.data.active == true && !resource.data.memberOnly
    || (resource.data.memberOnly && signedIn())
    || isAdmin();
  allow write: if isAdmin();
}


================================================================================
PROMPT P4-8 — Monetization Infrastructure
Repo: ezrarag/mkeblack
Priority: MEDIUM — enables revenue beyond Solidarity Circle dues
Depends on: P4-1, Prompt 2 (Stripe)
================================================================================

Build the monetization infrastructure for:
1. Sponsored search results
2. In-app/online advertising slots
3. City licensing framework (future)

## Part A — Sponsored Search Results

### Firestore Collection: sponsored_listings
{
  id: string,
  businessId: string,
  businessName: string,
  startDate: timestamp,
  endDate: timestamp,
  budget: number,              // total spend cap in cents
  spent: number,               // running total
  costPerClick: number,        // cents per click
  active: boolean,
  impressions: number,
  clicks: number,
  createdAt: timestamp
}

### Directory search — sponsored placement
- Sponsored businesses appear at TOP of results (above solidarity members)
- Labeled: "Sponsored" badge (subtle, gray, required by best practice)
- Max 2 sponsored results per search/filter
- Only active sponsored_listings where endDate > now AND spent < budget
- On card click: increment clicks counter, increment spent by costPerClick

### Admin: /admin/sponsored
- Table: business name, dates, budget, spent, impressions, clicks, CTR
- "Add sponsorship" form: business selector, date range, budget, CPC
- Active toggle
- Analytics: impressions/clicks chart per sponsorship

## Part B — Advertising Slots

### Firestore Collection: ad_slots
{
  id: string,
  name: string,              // "Homepage Banner", "Directory Sidebar"
  placement: 'homepage_top' | 'homepage_between_modules'
            | 'directory_sidebar' | 'directory_inline',
  advertiserName: string,
  imageUrl: string,
  clickUrl: string,
  startDate: timestamp,
  endDate: timestamp,
  active: boolean,
  impressions: number,
  clicks: number
}

### Ad slot components
Create <AdSlot placement="directory_sidebar" /> component.
Fetches active ad for that placement from Firestore.
If no active ad: renders nothing (no empty space).
Increments impressions on mount, clicks on click.

### Placements to implement:
- homepage_top: between hero and first module (optional, toggleable)
- directory_inline: every 8 cards in directory results
  ("Presented by [Advertiser]" style native card)

### Admin: /admin/ads
- List all ad slots with: name, placement, advertiser, dates, stats
- "Add ad" form: all fields + image upload
- Active toggle
- Performance stats: impressions, clicks, CTR

## Part C — City Licensing Framework (stub, no UI yet)

### Firestore Collection: city_licenses
{
  id: string,
  cityName: string,            // "Chicago", "Atlanta"
  licenseeOrg: string,
  contactEmail: string,
  status: 'prospect' | 'negotiating' | 'active' | 'churned',
  monthlyFee: number,
  startDate: timestamp | null,
  notes: string,
  createdAt: timestamp
}

Write this collection to Firestore schema + rules now.
No UI needed yet — admin can view in Firebase Console.
This stubs out the "Licensing to Other Cities" revenue line.

## Firestore rules
match /sponsored_listings/{id} {
  allow read: if true;
  allow write: if isAdmin();
}
match /ad_slots/{id} {
  allow read: if resource.data.active == true || isAdmin();
  allow write: if isAdmin();
}
match /city_licenses/{id} {
  allow read, write: if isAdmin();
}


================================================================================
PROMPT P4-9 — MKE Black Professionals (Full Phase 4 Spec)
Repo: ezrarag/mkeblack
Priority: MEDIUM — already partially planned in Prompt 12, this is the full spec
Note: This supersedes and replaces Prompt 12 from ALL_CODEX_PROMPTS.md
================================================================================

Build the complete MKE Black Professionals directory per the Phase 4 spec.

The spec defines this as: "A database for Black professionals who work for
larger non-Black owned entities but whose services are procurable to most
people and businesses — to build Black Capacity in those fields and promote
Black excellence for community advancement."

## Professional categories (from spec, seed these)
- Business Owners (auto-populated from businesses collection)
- Medical
- Legal
- Home Repair & Construction
- Financial Advisors & Accountants
- Loan & Program Officers (Direct Funding)
- Nonprofit Executive Directors
- School Administrators & College Professors
- Scientists
- Elected Officials & Department Leaders
- Spiritual Leaders & Advisors

## Firestore Collection: professionals
{
  id: string,
  uid: string | null,
  name: string,
  headline: string,
  bio: string,                 // "Narrative" from spec
  photoUrl: string,            // "Owner Pics" from spec
  industry: string,            // one of the categories above
  skills: string[],
  socialMedia: {
    instagram: string,
    linkedin: string,
    facebook: string,
    twitter: string
  },
  causesSupporting: string[],  // "Links to Causes Supporting" from spec
  appointmentUrl: string,      // "Link to Book an Appointment" from spec
  employerName: string,        // "Employer Link" from spec
  employerUrl: string,
  claimedBusinessIds: string[], // "List of Claimed Businesses" from spec
  location: string,            // neighborhood or city
  openToWork: boolean,
  openToCollaboration: boolean,
  beamParticipant: boolean,
  active: boolean,
  verified: boolean,
  autoPopulated: boolean,      // true if auto-created from business owner
  createdAt: timestamp,
  updatedAt: timestamp
}

## Auto-population from Business Owners
Per spec: "Business Owners (Automatic Population)"
When a business is claimed (ownerUid set):
- Check if a professional record exists for that uid
- If not: auto-create a stub record:
  { name: owner displayName, industry: 'Business Owners',
    claimedBusinessIds: [businessId], autoPopulated: true, verified: false }
- Owner can then log in and flesh out their professional profile

## Public page: /professionals
- Filter by industry category
- Filter by neighborhood
- Filter by "Book an Appointment" available
- Sort: verified first, then alphabetical
- Card: photo, name, headline, industry badge, top skills
- Verified badge on card

## Professional profile page: /professionals/[id]
Per spec sections:
1. Name + photo (circular, large)
2. Headline
3. Industry badge
4. Narrative (bio)
5. Social media links (Instagram, LinkedIn, etc.)
6. Causes Supporting (list with external links)
7. "Book an Appointment" CTA button (links to appointmentUrl)
8. Claimed Businesses: cards linking to /business/[id] for each
9. Employer: name + link to employerUrl
10. BEAM badge if applicable

## Self-registration: /professionals/new
Any signed-in MKE Black user can create a profile.
Form matches all fields above.
active: true, verified: false on creation.

## Dashboard tab: "Professional Profile"
Business owners and consumers see this tab.
Links to their profile or "Create your professional profile →"

## Seeding professional categories
Add seed data for industry categories to Firestore:
Collection: professional_categories
{ id, name, order, active }
Seed with the 11 categories from the spec.

## Admin: /admin/professionals
- Table: name, industry, verified badge, auto-populated badge, BEAM flag
- Verify / unverify
- Set claimedBusinessIds (link to businesses)
- Set beamParticipant
- Deactivate
- Filter: verified | unverified | auto-populated | BEAM | industry

## Firestore rules
match /professionals/{professionalId} {
  allow read: if resource.data.active == true || isAdmin();
  allow create: if signedIn();
  allow update: if isAdmin() ||
    (signedIn() && request.auth.uid == resource.data.uid);
  allow delete: if isAdmin();
}
match /professional_categories/{catId} {
  allow read: if true;
  allow write: if isAdmin();
}


================================================================================
RUN ORDER FOR PHASE 4 PROMPTS
================================================================================

Before running any Phase 4 prompts:
✅ Complete existing queued prompts 1–3 (homepage, Stripe, import)
✅ Deploy to Vercel
✅ Import CSV (Business+Directory 2026.csv)

Then run Phase 4 in this order:

P4-1  Solidarity Circle badge + search priority   ← depends on Stripe (P2)
P4-2  Now Open filter                             ← run any time, no deps
P4-3  List View / Map View toggle                 ← run any time
P4-4  Business page full spec                     ← run after P4-2
P4-5  Marketplace                                 ← depends on P4-1
P4-6  Jobs Board                                  ← depends on P4-1
P4-7  Survival Map                                ← run any time
P4-8  Monetization infrastructure                 ← depends on P4-1
P4-9  Professionals directory (full spec)         ← run last, biggest

For the meeting Monday: demonstrate P4-2 (Now Open) and P4-3 (List/Map)
as they have no dependencies and show immediately impressive results.

================================================================================
END OF PHASE 4 PROMPTS
================================================================================
