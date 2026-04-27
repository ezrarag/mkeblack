################################################################################
#                                                                              #
#   MKE BLACK — MASTER CODEX PROMPT QUEUE                                     #
#   All 12 prompts in one file, in run order                                   #
#   Repo: ezrarag/mkeblack                                                     #
#   Last updated: April 2026                                                   #
#                                                                              #
#   HOW TO USE                                                                 #
#   1. Open Codex desktop app                                                  #
#   2. Set repo to ezrarag/mkeblack                                            #
#   3. Copy ONE prompt section at a time (between the === lines)               #
#   4. Run it. Wait for build to pass.                                         #
#   5. Commit. Then move to the next prompt.                                   #
#   6. Always end each session with:                                           #
#      npx tsc --noEmit && npm run lint && npm run build                       #
#                                                                              #
#   GLOBAL TECH NOTES (apply to every prompt)                                  #
#   - Stack: Next.js 14 App Router, Firebase/Firestore, Tailwind, Framer Motion#
#   - Auth: Firebase Auth + Firestore users/{uid} with role field              #
#   - Admin check: role === 'admin' in Firestore users doc                     #
#   - Maps: Mapbox (not Google Maps) — token in NEXT_PUBLIC_MAPBOX_TOKEN       #
#   - No Supabase. Firebase/Firestore only.                                    #
#   - GitHub handle: ezrarag                                                   #
#   - SheetJS (xlsx package) for any spreadsheet parsing                       #
#                                                                              #
################################################################################


================================================================================
PROMPT 1 — Homepage Module CMS + Admin Controls
Repo: ezrarag/mkeblack
Status: COMPLETE — Codex ran this, build passed
================================================================================

SKIP — Already built. Confirmed working:
- /app/admin/homepage/page.tsx
- components/homepage/homepage-admin-page.tsx
- components/homepage/homepage-page.tsx
- lib/firebase/homepage.ts
- hooks/use-homepage-modules.ts

Firestore collections seeded: homepage_modules, member_discounts


================================================================================
PROMPT 2 — Stripe Membership Portal
Repo: ezrarag/mkeblack
Status: QUEUED — run after base site is deployed to Vercel
================================================================================

Add a Stripe-powered membership signup flow and admin membership dashboard.

## Stripe Setup
- Use Stripe Checkout (hosted) for payment collection
- Create one Product in Stripe: "MKE Black Solidarity Circle" with a monthly price
- On success, Stripe webhook writes to Firestore `members` collection

## Step Form (/membership)
Step 1: Personal Info — name, email, phone
Step 2: Plan selection — show membership tier(s) with benefits listed
Step 3: Payment — redirect to Stripe Checkout
Step 4: Success page — confirm membership, show next steps

## API Routes
POST /api/membership/checkout
- Creates Stripe Checkout session
- Stores pending member doc in Firestore with status: 'pending'
- Returns { url } to redirect to Stripe

POST /api/webhooks/stripe
- Handles checkout.session.completed event
- Updates Firestore member doc:
  status → 'active', adds stripeCustomerId, subscriptionId, plan, startDate

## Firestore Collection: members
{
  id,
  name, email, phone,
  stripeCustomerId,
  subscriptionId,
  plan: string,
  status: 'pending' | 'active' | 'suspended',
  startDate: timestamp,
  benefits: [
    { id, label, active: boolean, addedBy: 'auto' | 'admin', addedAt: timestamp }
  ],
  notes: string
}

## Admin Membership Dashboard (/admin/members)
- Table of all members: name, email, plan, status, join date, # active benefits
- Filter by status
- Click member → detail slide-over:
  - View/edit notes
  - Toggle member status (active / suspended)
  - Add custom benefit (label + active toggle)
  - Deactivate specific benefits
- "Benefit Types" tab:
  - Global list of benefit types (e.g. "MKE Black T-Shirt", "Event Access")
  - Toggle a benefit type off = marks inactive across ALL members who have it
  - Admin can create new benefit types that auto-apply or opt-in only

## Firestore Collection: benefit_types
{ id, label, description, active: boolean, autoApply: boolean, createdAt }

## Firestore Rules (add to existing)
match /members/{memberId} {
  allow read: if isSelf(memberId) || isAdmin();
  allow create: if true;
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
match /benefit_types/{benefitId} {
  allow read: if true;
  allow write: if isAdmin();
}

## Env vars needed
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY


================================================================================
PROMPT 3 — Excel / CSV Data Migration Tool
Repo: ezrarag/mkeblack
Status: COMPLETE — Codex ran this, CSV import working
================================================================================

SKIP — Already built and working:
- /app/admin/import/page.tsx
- components/admin/business-import-page.tsx
- CSV import tested with Business+Directory 2026.csv
- Category parser (Wix JSON array format) fixed in lib/firebase/businesses.ts
- Phone normalization added


================================================================================
PROMPT 4 — Consumer Favorites + Reviews
Repo: ezrarag/mkeblack
Status: QUEUED
================================================================================

Add consumer favorites and reviews to the MKE Black directory.

## Firestore Collections

### users/{uid}/favorites/{businessId}  (subcollection)
{ businessId: string, favoritedAt: timestamp }

### businesses/{businessId}/reviews/{reviewId}  (subcollection)
{
  uid: string,
  displayName: string,
  rating: number (1–5),
  text: string,
  createdAt: timestamp,
  visible: boolean  (default true)
}

## Consumer Auth — new route /join
- Firebase Auth (Google or email/password)
- On create: write users/{uid} with role: 'consumer'
- Separate from business owner (/login) and admin flows
- Header shows "Join" button when logged out (alongside existing "Business Login")

## Directory card changes
- Heart icon on each business card
- If consumer signed in and favorited: heart filled gold
- Click heart → toggle favorite in Firestore
- Show favorite count next to heart (public, visible to all)

## Business profile page (/business/[id]) additions
- Average star rating display (computed from reviews subcollection)
- Review count
- If consumer signed in: "Leave a review" form (1–5 stars + text, 500 char limit)
- Public reviews list (visible: true only) — displayName, rating, date, text

## Admin reviews management
In /admin/businesses/[id] add a "Reviews" tab:
- List all reviews for the business
- Toggle visible on/off per review
- Show total count, average rating, flagged count

## Firestore Rules (add to existing)
match /users/{uid}/favorites/{businessId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == uid;
}
match /businesses/{businessId}/reviews/{reviewId} {
  allow read: if resource.data.visible == true || isAdmin();
  allow create: if request.auth != null;
  allow update, delete: if isAdmin();
}


================================================================================
PROMPT 5 — Events Collection + Homepage Module
Repo: ezrarag/mkeblack
Status: QUEUED
================================================================================

Add a community events feature.

## Firestore Collection: events
{
  id: string,
  title: string,
  businessId: string | null,
  businessName: string,
  date: timestamp,
  endDate: timestamp | null,
  description: string,
  photoUrl: string,
  address: string,
  ticketUrl: string,
  free: boolean,
  active: boolean,
  createdAt: timestamp
}

## Public page: /events
- List upcoming events (date >= now, active: true)
- Filter: this week | this month | free only
- Event card: photo, title, business name, date, free/paid badge, address
- Link to ticketUrl if present

## Admin page: /admin/events
- Create / edit / delete events
- Toggle active
- Link event to a business in the directory (optional)

## Homepage module type: 'events'
Add 'events' as a valid HomepageModuleType in lib/types.ts
When visible, renders next 3 upcoming events as cards on the homepage.
Admin can toggle on/off from /admin/homepage like any other module.

## Firestore Rules (add to existing)
match /events/{eventId} {
  allow read: if resource.data.active == true || isAdmin();
  allow write: if isAdmin();
}


================================================================================
PROMPT 6 — Google Workspace Admin Integration
Repo: ezrarag/mkeblack
Status: QUEUED — run after base site deployed, needs Google OAuth scopes
================================================================================

Add a Google Workspace integration tab to the MKE Black admin area.
Gives MKE Black admins Gmail, Google Drive, and Google Calendar
directly inside the admin dashboard.

## Auth Setup
Use Firebase Google Sign-In (already configured).
After Google sign-in, capture the OAuth access token from UserCredential.
Store in React context (GoogleTokenContext).
Expose useGoogleToken() hook.

## New Page: /admin/workspace
File: app/admin/workspace/page.tsx
Component: components/admin/workspace/workspace-page.tsx
Three tabs: Gmail | Drive | Calendar

## Tab 1 — Gmail
Use: https://gmail.googleapis.com/gmail/v1/users/me/messages
- Fetch last 30 threads (list → batch-get subjects/senders)
- Table: From | Subject | Date | Snippet
- Filter: keyword search, label (Inbox/Sent/Unread)
- Click thread → expand full body
- "Mark as Read" button
- Urgency badge: "urgent"/"ASAP"/"issue" → 🔴 High | "question"/"update" → 🟡 Med | else 🟢

## Tab 2 — Drive
Use: https://www.googleapis.com/drive/v3/files
- List files (pageSize: 50, orderBy: modifiedTime desc)
- Show: icon by mimeType | Name | Modified | Size
- Folder navigation with breadcrumb
- Search bar by filename
- .xlsx/.csv files: green "Importable" badge + "Import to Directory" button
  → navigates to /admin/import with fileId query param
- All files: "Open in Drive" → drive.google.com link

## Tab 3 — Calendar
Use: https://www.googleapis.com/calendar/v3/calendars/primary/events
- Show next 30 days (timeMin: now, timeMax: +30 days)
- List or week view toggle
- "Create Event" slide-over: title, date, start/end time, location, description

## Firestore Caching
Write results to gw_gmail, gw_calendar, gw_drive collections with cachedAt.
If cachedAt < 5 min ago, read from Firestore instead of API.
"Refresh" button forces fresh API pull.

## Google OAuth Scopes (add to GoogleAuthProvider)
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar');

## If admin signed in with email (not Google)
Show "Connect Google Account" button → linkWithPopup(GoogleAuthProvider)

## Files to create
- app/admin/workspace/page.tsx
- components/admin/workspace/workspace-page.tsx
- components/admin/workspace/gmail-tab.tsx
- components/admin/workspace/drive-tab.tsx
- components/admin/workspace/calendar-tab.tsx
- lib/google-workspace.ts
- hooks/use-google-token.ts

Add "Workspace" link to admin nav.


================================================================================
PROMPT 7 — Hroshi Partner Page on readyaimgo.biz
Repo: ready-aim-go-website-for-deploy (ezrarag)
Status: COMPLETE — file written directly to local codebase
================================================================================

SKIP — Already built:
- app/benefit/[slug]/page.tsx
- Config-driven: add new partners by adding to BENEFIT_CONFIGS object
- Current live route: /benefit/hroshi
- To add PaynePros or any other partner: add one entry to BENEFIT_CONFIGS


================================================================================
PROMPT 8 — Near Me + Milwaukee Neighborhood GIS Filter + Map Improvements
Repo: ezrarag/mkeblack
Status: QUEUED — HIGH PRIORITY, Rick + Solana requested on call
================================================================================

## Part A — "Near Me" button

Add to components/directory/directory-page.tsx

### New state
const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
const [sortByDistance, setSortByDistance] = useState(false);

### Add to lib/utils.ts — Haversine distance formula
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

### Button behavior
- Label: "Near me" (off) / "Showing nearest first ✕" (on, click to cancel)
- On click: navigator.geolocation.getCurrentPosition with 5s timeout
  - Success: setUserLocation + setSortByDistance(true)
  - Denied: inline message "Enable location to use this feature"
  - Timeout: "Location unavailable"
- Show spinner on button while geolocation is pending
- When active: sort filteredBusinesses by haversineKm ascending
- Distance badge on each card: "0.4 mi" (km × 0.621), shown only when active

## Part B — Milwaukee Neighborhood Filter via Official GIS API

### Confirmed GIS endpoint
https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/AGO/neighborhoods/MapServer/0/query
  ?where=1%3D1&outFields=NEIGHBORHD&outSR=4326&f=geojson

Field name: NEIGHBORHD (50-char string)
IMPORTANT: always pass outSR=4326 — Milwaukee GIS uses State Plane NAD27 (SRID 32054)
by default which won't work with Mapbox. outSR=4326 converts to standard lat/lng.

### New Firestore collection: milwaukee_neighborhoods
On directory first load, check if collection has docs.
If empty: fetch from ArcGIS URL, write each neighborhood:
{ id: slugified(NEIGHBORHD), name: titleCase(NEIGHBORHD), geojson: <GeoJSON feature> }
Cache permanently — Milwaukee neighborhood boundaries don't change.

### New file: lib/neighborhood.ts
Implement:
1. pointInPolygon(lat, lng, polygon: number[][]): boolean  (ray casting)
2. getNeighborhoodForPoint(lat, lng, neighborhoods[]): string | null

### Add to lib/types.ts Business + BusinessFormValues
neighborhood: string;

### Auto-assign on save + import
In lib/firebase/businesses.ts:
- saveBusiness(): after geocoding, run getNeighborhoodForPoint, write neighborhood
- importBusinesses(): fetch neighborhoods once at top of loop, assign per business

### Directory filter
Add "Neighborhood" dropdown after Category.
Populate from distinct neighborhood values in businesses collection.
Filter: business.neighborhood === selected (or "all")

### Admin
In business-edit-page.tsx: show neighborhood as read-only + "Re-detect" button

## Part C — Map improvements

### Layout (critical — map should always be visible)
Desktop: 55% cards grid (left) / 45% sticky map (right), map height = viewport
Mobile: "Map view" pill toggle at top of results.
  When on: map at 280px height above card list.
  When off: map hidden, cards full width.

### New map features
1. User location dot — blue pulsing circle at userLocation when Near Me active
2. Neighborhood polygon overlay — when neighborhood filter active:
   - Draw GeoJSON boundary from milwaukee_neighborhoods
   - Gold stroke (#D4A017), 15% fill opacity
   - Auto-zoom map to fit neighborhood bounds (fitBounds)
3. Marker clustering — when >15 businesses in view:
   Use Mapbox GL clustering (cluster: true on GeoJSON source)
   Cluster pin shows count, expands on click
4. Card ↔ map sync:
   - Click business card → map flies to that pin, opens popup
   - Click map pin → card list scrolls to that business, highlights card

### Map popup content (per pin)
- Business name (bold)
- Category (small muted text)
- Hours status: "Open now" (green dot) or "Closed" (red dot) — live check
- "View listing →" link to /business/[id]


================================================================================
PROMPT 9 — Business Hours Auto-Scrub via Google Places API
Repo: ezrarag/mkeblack
Status: QUEUED — HIGH PRIORITY, data quality
================================================================================

Build an admin tool to automatically look up and update hours for businesses
imported from CSV (which have all days closed: true by default).

## New admin page: /admin/hours-sync
## New API route: POST /api/admin/scrape-hours  (server-side only)

### How it works
1. Query Firestore: businesses where EVERY day has closed: true (no hours set)
2. For each business, call Google Places Text Search:

GET https://maps.googleapis.com/maps/api/place/findplacefromtext/json
  ?input={businessName} {address} Milwaukee
  &inputtype=textquery
  &fields=place_id,name,opening_hours
  &key={NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}

3. If place found, fetch full details:
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id={placeId}
  &fields=opening_hours
  &key={NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}

4. Parse opening_hours.periods[] into BusinessHours schema:
   periods format: [{ open: { day: 0-6, time: "0900" }, close: { day: 0-6, time: "2100" } }]
   day mapping: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

5. Present to admin for review before saving

### New Business fields (add to lib/types.ts)
hoursSource: 'manual' | 'google_places' | 'imported_text' | null;
hoursSkipped: boolean;
hoursLastSynced: Date | null;

### Admin UI: /admin/hours-sync

Step 1 — Scope
- Show count: "247 businesses have no hours set"
- "Start sync" button

Step 2 — Live progress
- Process in batches of 10 (rate limit: 10/min for Google Places)
- Progress bar: "Processed 23 of 247 (~18 min remaining)"
- Store session in Firestore so admin can close + return:
  admin_sync_sessions/{sessionId}
  { status, processed, total, results[], startedAt, updatedAt }

Step 3 — Review queue (fills as processing runs)
Each card shows:
- Business name + address
- Proposed hours in a readable format (Mon 9am–5pm, Tue closed, etc.)
- Confidence: "✓ Found on Google Places" or "✗ Not found — skipped"
- Actions: [Approve ✓] [Edit + Approve] [Skip]
- Approve: saves hours to Firestore, sets hoursSource: 'google_places', hoursLastSynced: now
- Skip: sets hoursSkipped: true, won't appear in future syncs

### Firestore rules (add to existing)
match /admin_sync_sessions/{sessionId} {
  allow read, write: if isAdmin();
}


================================================================================
PROMPT 10 — Business Owner Profile + Team Section
Repo: ezrarag/mkeblack
Status: QUEUED — Solana's idea from meeting
================================================================================

Add an owner profile and optional team section to each public business listing.

## New Firestore subcollection: businesses/{id}/team
Each doc = one team member:
{
  id: string,
  uid: string | null,       // Firebase UID if they have an MKE Black account
  name: string,
  role: string,             // "Owner", "Manager", "Chef", etc.
  bio: string,              // 2–3 sentences, 300 char limit
  photoUrl: string,         // Firebase Storage URL
  linkedinUrl: string,
  instagramUrl: string,
  order: number,
  isOwner: boolean,         // Primary owner shown first, different display
  visible: boolean,
  addedAt: timestamp
}

## Add to Business type (lib/types.ts)
hasTeamProfiles: boolean;

## Public business profile page (/business/[id])
Add section after main business info, only if hasTeamProfiles === true:

- Header: "Meet the owner" (1 member, isOwner) or "Meet the team" (multiple)
- Owner card (always first):
  - Circular photo (80px), name, role badge, bio, LinkedIn + Instagram icons
- If >1 member: "See the full team" expand toggle
  - Grid of remaining members: photo, name, role, bio snippet, social links

## Owner dashboard — new "Team" tab
Add tab alongside listing editor.

Tab UI:
- Drag-reorderable list of current team members
- "Add team member" → slide-over form:
  - Name, Role, Bio (textarea + 300 char counter)
  - Photo upload → Firebase Storage: businesses/{id}/team-photos/
  - LinkedIn URL, Instagram URL
  - Visible toggle
- Edit / Remove per member
- "Mark as primary owner" toggle (sets isOwner: true, clears it on others)

On save:
- Write to businesses/{id}/team subcollection
- If any visible members: set businesses/{id} hasTeamProfiles = true
- If no visible members: set hasTeamProfiles = false

## Admin — team tab
In /admin/businesses/[id]: add "Team" tab alongside listing editor.
Admin can add/edit/remove team members during onboarding without owner login.

## Firestore rules (add to existing)
match /businesses/{businessId}/team/{memberId} {
  allow read: if resource.data.visible == true || isAdmin() || ownsBusiness();
  allow write: if isAdmin() || ownsBusiness();
}


================================================================================
PROMPT 11 — Business Tags System
Repo: ezrarag/mkeblack
Status: QUEUED — Rick/Solana meeting: "LGBT affiliated, vegan, etc."
================================================================================

Add a flexible tags system admin can manage and owners can self-select from.

## New Firestore collection: business_tags
{
  id: string,
  label: string,        // "LGBTQ+ Affirming", "Vegan Options", "Soul Food"
  slug: string,         // "lgbtq-affirming", "vegan-options", "soul-food"
  category: string,     // "Identity" | "Dietary" | "Accessibility" | "Vibe" | "Service"
  active: boolean,
  adminOnly: boolean,   // true = only admin can assign (not owner self-service)
  createdAt: timestamp,
  usageCount: number    // updated on business save
}

## Add to Business + BusinessFormValues (lib/types.ts)
tags: string[];  // slugs e.g. ["black-owned", "vegan-options", "lgbtq-affirming"]

## Seed tags — write to Firestore on deploy (add to seed-firestore.js)
Identity (adminOnly: true for "black-owned"):
  "Black-owned", "LGBTQ+ Affirming", "Woman-owned", "Veteran-owned", "Minority-owned"
Dietary:
  "Vegan Options", "Vegetarian", "Gluten-Free", "Halal", "Soul Food", "Caribbean"
Vibe:
  "Family-Friendly", "Date Night", "Live Music", "Outdoor Seating", "Late Night"
Accessibility:
  "Wheelchair Accessible", "ASL Friendly"
Service:
  "Delivery", "Takeout", "Catering", "Appointment Only", "Walk-ins Welcome"

## Public directory
- Tag filter row below main filters (collapsible on mobile, max 2 rows)
- Pills: multi-select
- Toggle: "Match all" / "Match any"
- Selected tags: gold fill. Unselected: outlined.

## Public business profile page
- Tag pills below business name/category
- Each pill links to /directory?tag={slug}

## Owner dashboard — Tags section in listing editor
- Grid of all active, non-adminOnly tags as toggleable pills
- Owner selects which apply → updates tags[] on save

## Admin: /admin/tags (new page)
- List all tags: label, category, usageCount, active toggle, adminOnly toggle
- "Add tag" button: label, slug (auto from label), category, adminOnly toggle
- Edit existing tags
- Deactivate → removes tag from all business docs (batch write, confirm dialog)
- "Merge tags": pick source + target → reassign all businesses, delete source

## Firestore rules
match /business_tags/{tagId} {
  allow read: if true;
  allow write: if isAdmin();
}

Add "Tags" link to admin nav.


================================================================================
PROMPT 12 — Professionals Directory
Repo: ezrarag/mkeblack
Status: QUEUED — Rick/Solana meeting. Plan now, build after Prompts 8–11.
================================================================================

Add a "Professionals" section — a LinkedIn-style people directory for Black
professionals in Milwaukee. Separate from the business directory.
Also feeds BEAM Institute talent pipeline.

## New Firestore collection: professionals
{
  id: string,
  uid: string | null,           // Firebase UID if they have an MKE Black account
  name: string,
  headline: string,             // "Full-stack developer & entrepreneur"
  bio: string,
  photoUrl: string,
  location: string,             // neighborhood or "Milwaukee, WI"
  industries: string[],         // ["Tech", "Marketing", "Finance", "Healthcare"]
  skills: string[],             // free-form chips: ["React", "Brand Strategy"]
  linkedinUrl: string,
  websiteUrl: string,
  instagramUrl: string,
  businessId: string | null,    // links to businesses collection
  beamParticipant: boolean,     // BEAM Institute flag — set by admin only
  openToWork: boolean,
  openToCollaboration: boolean,
  active: boolean,
  verified: boolean,            // admin-verified
  createdAt: timestamp,
  updatedAt: timestamp
}

## Public pages

### /professionals
- Search: name, headline, skills (debounced, client-side)
- Filters: Industry | Neighborhood | Open to work | BEAM participants
- Card grid: circular photo, name, headline, top 3 skills as pills, badges
- "Open to work" badge: subtle green dot + text (not desperate-feeling)
- BEAM badge: tasteful, distinct from open-to-work

### /professionals/[id]
- Full profile: photo, name, headline, bio
- Skills as pills
- Industry tags
- Links: LinkedIn, website, Instagram
- If businessId: "Also owner of [Name] →" links to /business/[id]
- BEAM badge if beamParticipant
- Contact button (if openToCollaboration): opens simple contact form
  (name + message, routes to professional's email via API route)

### /professionals/new — Self-registration
Any signed-in user (consumer, business, or admin role) can create a profile.
Form: name, headline, bio, photo upload, industries (multi-select),
skills (free-text chip input), LinkedIn, website, Instagram,
open-to-work toggle, open-to-collaboration toggle.
On save: active: true, verified: false.

## Dashboard integration
Business owners at /dashboard see a second tab: "My professional profile"
Links to /professionals/[id] or "Create your profile →"

## Admin: /admin/professionals
- Table: name, headline, verified badge, BEAM flag, created date
- Verify / unverify / deactivate
- Set businessId link
- Set beamParticipant flag (admin only)
- Filter: verified | unverified | BEAM | open to work

## BEAM connection (important for architecture)
professionals collection must be readable cross-project.
The BEAM Transportation site (transportation.beamthinktank.space) and
readyaimgo.biz will both query this collection to surface available talent.
Firestore rules must allow public read for active + verified professionals.

## Firestore rules
match /professionals/{professionalId} {
  allow read: if resource.data.active == true || isAdmin();
  allow create: if request.auth != null;
  allow update: if isAdmin() ||
    (request.auth != null && request.auth.uid == resource.data.uid);
  allow delete: if isAdmin();
}

## UX notes from meeting
- This is a VISIBILITY tool, not a job board
- Think LinkedIn profile page aesthetic, not Indeed listing
- Professionals should feel proud to be listed
- "Open to work" badge must be subtle — small indicator, not a banner
- BEAM participants get a tasteful badge that explains what BEAM is on hover
- Phase 2 (future): professionals can endorse each other's skills


================================================================================
RUN ORDER SUMMARY
================================================================================

DONE:
  ✅ Prompt 1  — Homepage Module CMS
  ✅ Prompt 3  — CSV/Excel Migration Tool
  ✅ Prompt 7  — Hroshi Partner Page (readyaimgo.biz)

QUEUED — run in this order:

  🔲 Prompt 2  — Stripe Membership Portal
                 Needs: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET in Vercel

  🔲 Prompt 4  — Consumer Favorites + Reviews
                 Needs: consumer auth flow first

  🔲 Prompt 5  — Events Collection + Homepage Module
                 Can run any time after Prompt 1

  🔲 Prompt 6  — Google Workspace Admin (Gmail/Drive/Calendar)
                 Needs: site deployed + Google OAuth scopes configured

  🔲 Prompt 8  — Near Me + Milwaukee GIS Neighborhoods + Map (HIGH PRIORITY)
                 Needs: NEXT_PUBLIC_MAPBOX_TOKEN set (already done)
                 Note: Milwaukee GIS field is NEIGHBORHD, always pass outSR=4326

  🔲 Prompt 9  — Hours Scrub via Google Places API (HIGH PRIORITY)
                 Needs: Enable "Places API" in Google Cloud Console
                 Same API key as Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)

  🔲 Prompt 10 — Business Owner Profile + Team Section
                 No extra env vars needed

  🔲 Prompt 11 — Tags System
                 No extra env vars needed
                 Run seed-firestore.js again after to seed default tags

  🔲 Prompt 12 — Professionals Directory (biggest lift, run last)
                 Note: professionals collection must be public-readable
                 for BEAM + RAG cross-project use

================================================================================
ENV VARS CHECKLIST — make sure these are in Vercel before running
================================================================================

Firebase (all set locally, must add to Vercel):
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
  NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL
  NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY    ← paste full key with real \n newlines

Maps + Location:
  NEXT_PUBLIC_MAPBOX_TOKEN                  ← already set locally ✓
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY           ← needed for Prompts 9 (Places API)
                                              Enable "Places API" in Google Cloud

Stripe (for Prompt 2):
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

Admin provisioning:
  NEXT_PUBLIC_ADMIN_PROVISION_SECRET        ← generate: openssl rand -base64 32

================================================================================
END OF MASTER PROMPT QUEUE
Last updated: April 2026
================================================================================
