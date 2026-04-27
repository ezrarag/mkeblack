================================================================================
PROMPT 8 — Near Me + Neighborhood Filter + Map Improvements
Repo: ezrarag/mkeblack
Priority: HIGH — discussed in Rick/Solana meeting
================================================================================

## Part A — "Near Me" button

Add a "Near me" button to the directory filter bar in
components/directory/directory-page.tsx

### State additions
```
const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
const [sortByDistance, setSortByDistance] = useState(false);
```

### Haversine distance helper (add to lib/utils.ts)
```
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
```

### Near Me button behavior
- Button label: "Near me" (inactive) / "Showing nearest first ✕" (active, click to cancel)
- On click: call navigator.geolocation.getCurrentPosition
  - On success: setUserLocation + setSortByDistance(true)
  - On denied: show inline message "Enable location to use this feature"
- When active: sort filteredBusinesses by haversineKm from userLocation ascending
- Distance badge on each business card: "0.4 mi" (convert km × 0.621)
  - Only shown when sortByDistance is true
  - Appears below business name, small gray text

### Loading state
- Show a spinner on the Near Me button while geolocation is pending
- Geolocation has a 5-second timeout — if exceeded, show "Location unavailable"

---

## Part B — Milwaukee Neighborhood Filter via Official GIS API

### API details (confirmed working)
The City of Milwaukee provides official neighborhood boundary polygons at:
```
https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/AGO/neighborhoods/MapServer/0/query
  ?where=1%3D1
  &outFields=NEIGHBORHD
  &outSR=4326
  &f=geojson
```
The field name is `NEIGHBORHD` (not NEIGHBORHOOD). Returns GeoJSON polygons.
The coordinate system must be converted: request outSR=4326 for standard lat/lng.

### New Firestore collection: milwaukee_neighborhoods
On first load of the directory, check if this collection has data.
If empty, fetch from the ArcGIS URL above and write each neighborhood as:
```
{
  id: string (slugified NEIGHBORHD),
  name: string (NEIGHBORHD value, title-cased),
  geojson: object (the GeoJSON polygon feature)
}
```
Cache indefinitely — these boundaries don't change.

### New lib/neighborhood.ts
```
// Point-in-polygon using ray casting algorithm
export function pointInPolygon(
  lat: number, lng: number,
  polygon: number[][]  // array of [lng, lat] pairs
): boolean { ... }

// Given a lat/lng, return the neighborhood name
export async function getNeighborhoodForPoint(
  lat: number, lng: number,
  neighborhoods: NeighborhoodDoc[]
): Promise<string | null> { ... }
```

### Business schema addition (lib/types.ts)
Add to Business and BusinessFormValues:
```
neighborhood: string;  // e.g. "Bronzeville", "Bay View", "Sherman Park"
```

### Auto-assign neighborhood on save
In lib/firebase/businesses.ts saveBusiness():
- After geocoding the address to lat/lng
- Run getNeighborhoodForPoint() against cached neighborhood polygons
- Write neighborhood field to Firestore doc

### On import
In importBusinesses(): after geocoding each address, assign neighborhood.
Run as a batch — fetch neighborhoods once at top of import loop, reuse.

### Directory filter UI
Add a "Neighborhood" dropdown to the filter bar, after the Category dropdown.
- Options: "All neighborhoods" + sorted list of distinct neighborhood values
  from the businesses collection (query Firestore for distinct values)
- On select: filter filteredBusinesses where business.neighborhood === selected

### Admin — neighborhood field
In components/admin/business-edit-page.tsx:
- Show neighborhood as a read-only field (auto-assigned from geocoding)
- Add "Re-detect" button that re-runs the point-in-polygon for that business

---

## Part C — Map improvements

### Map placement
Move the map so it is ALWAYS visible on the directory page — not behind a toggle.
Layout: 
- Desktop: split view — left 55% is business cards grid, right 45% is sticky map
- Mobile: map collapses to a pill-shaped "Map view" toggle at the top of results
  When toggled: map takes full width at 280px height, cards below

### Map features to add
1. User location dot — when Near Me is active, show a blue pulsing dot at userLocation
2. Neighborhood highlight — when a neighborhood filter is selected:
   - Draw the neighborhood polygon boundary on the map (GeoJSON overlay)
   - Amber/gold stroke, 20% fill opacity
   - Zoom map to fit the neighborhood bounds
3. Cluster markers — when >15 businesses in view, cluster into numbered pins
   (use mapbox-gl built-in clustering — set cluster: true on the GeoJSON source)
4. Active business highlight — clicked card scrolls map to that pin and opens popup
   Clicked pin scrolls the card list to that business

### Map popup content
Each pin popup shows:
- Business name (bold)
- Category (small, muted)
- Hours status: "Open now" (green) or "Closed" (red) based on current day/time
- "View listing →" link to /business/[id]


================================================================================
PROMPT 9 — Business Hours Scrub via Web Search
Repo: ezrarag/mkeblack
Priority: HIGH — Rick/Solana meeting request
================================================================================

Build an admin tool that automatically looks up and updates business hours
for imported businesses that have no structured hours set.

## New admin page: /admin/hours-sync

### Purpose
After CSV import, most businesses have hours.closed = true on all days
(because the CSV had no hours data). This tool:
1. Finds all businesses where ALL days are closed (hours not yet set)
2. For each, searches the web for their current hours
3. Parses the result and pre-fills structured hours for admin review
4. Admin approves or edits before saving

### API route: POST /api/admin/scrape-hours
Server-side only (never expose to client directly).
Uses the business name + address to construct a search query.

Implementation:
```
// Query: "{businessName} {address} hours"
// Use Google Places API (Text Search) — already have Maps key
// OR use Serper/Bing Search API if no Places key

const query = `${business.name} ${business.address} Milwaukee hours`;

// Option A — Google Places Text Search (preferred, uses existing Google key)
GET https://maps.googleapis.com/maps/api/place/findplacefromtext/json
  ?input={query}
  &inputtype=textquery
  &fields=place_id,name,opening_hours
  &key={GOOGLE_PLACES_API_KEY}

// Then fetch full place details:
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id={placeId}
  &fields=opening_hours
  &key={GOOGLE_PLACES_API_KEY}

// Returns opening_hours.periods[] — parse into our BusinessHours schema
```

### Parsing Google Places periods[] into BusinessHours
```
// periods is [{open: {day: 0, time: "0900"}, close: {day: 0, time: "2100"}}]
// day: 0=Sunday, 1=Monday ... 6=Saturday
// Map to our DayKey schema and populate hours object
```

### Admin UI flow (/admin/hours-sync)

Step 1 — Businesses needing hours
- Query Firestore for businesses where every day has closed: true
- Show count: "142 businesses have no hours set"
- "Start sync" button — begins processing in batches of 10

Step 2 — Processing (live)
- Progress bar: "Processed 23 of 142"
- Each processed business shows in a review queue below

Step 3 — Review queue
- Each card shows: business name, address, proposed hours (parsed from Google)
- Confidence indicator: "Found on Google Places" (high) or "Not found" (skip)
- Admin can: Approve ✓ | Edit then approve | Skip
- Approve → saves hours to Firestore, marks hoursSource: "google_places"
- Skip → marks hoursSkipped: true so it doesn't appear again

### New fields on Business (lib/types.ts)
```
hoursSource: 'manual' | 'google_places' | 'imported_text' | null;
hoursSkipped: boolean;
hoursLastSynced: Date | null;
```

### Rate limiting
Process max 10 businesses per minute (Google Places API quota).
Show estimated time remaining during sync.
Store results in Firestore as a sync session so admin can close
and return without losing progress:
```
admin_sync_sessions/{sessionId}
{ status, processed, total, results[], startedAt, updatedAt }
```

### Firestore rules
```
match /admin_sync_sessions/{sessionId} {
  allow read, write: if isAdmin();
}
```


================================================================================
PROMPT 10 — Business Owner Profile + Team Section
Repo: ezrarag/mkeblack
Priority: MEDIUM — Rick/Solana meeting request
================================================================================

Add an owner profile and optional team section to each business listing.

## New Firestore subcollection: businesses/{id}/team
Each document = one team member:
```
{
  id: string,
  uid: string | null,           // Firebase UID if they have an account
  name: string,
  role: string,                 // e.g. "Owner", "Manager", "Chef"
  bio: string,                  // 2-3 sentence bio
  photoUrl: string,             // Firebase Storage URL
  linkedinUrl: string,
  instagramUrl: string,
  order: number,
  isOwner: boolean,             // Primary owner gets special display
  visible: boolean,
  addedAt: timestamp
}
```

## Business schema addition (lib/types.ts)
```
hasTeamProfiles: boolean;  // quick flag to show "Meet the team" button
```

## Public business profile page (/business/[id]) — additions

After the main business info block, add:

### Owner/team section
Only shown if hasTeamProfiles === true
- Section header: "Meet the owner" (if only 1 team member marked isOwner)
  or "Meet the team" (if multiple)
- Owner card (always first):
  - Photo (circular, 80px)
  - Name + role badge
  - Bio text
  - Social links (LinkedIn, Instagram icons)
- "See the full team" expand toggle (if >1 member)
  - Expands to show all team members in a grid
  - Each card: photo, name, role, bio snippet, social links

## Owner dashboard — Team management tab

Add a "Team" tab to /dashboard alongside the listing editor.

### Team tab UI
- List of current team members with drag-to-reorder
- "Add team member" button → slide-over form:
  - Name, Role, Bio (textarea, 300 char limit with counter)
  - Photo upload (Firebase Storage → businesses/{id}/team-photos/)
  - LinkedIn URL, Instagram URL
  - Visible toggle
  - Save button
- Edit / Remove per member
- Owner can mark which member is the primary owner (isOwner: true)

### Saving
On team member save:
- Write to businesses/{id}/team subcollection
- If team has any visible members: update businesses/{id} hasTeamProfiles = true
- If no visible members remain: set hasTeamProfiles = false

## Firestore rules
```
match /businesses/{businessId}/team/{memberId} {
  allow read: if resource.data.visible == true || isAdmin() || ownsBusiness();
  allow write: if isAdmin() || ownsBusiness();
}
```

## Admin — team management
In /admin/businesses/[id], add a "Team" tab alongside the listing editor.
Admin can add/edit/remove team members for any business (e.g. during onboarding).


================================================================================
PROMPT 11 — Business Tags System (Admin-Managed, Owner-Updateable)
Repo: ezrarag/mkeblack
Priority: MEDIUM — Rick/Solana meeting request
================================================================================

Add a flexible tags system — categories within categories — that admins
can manage and business owners can self-select from.

## New Firestore collection: business_tags
```
{
  id: string,
  label: string,          // e.g. "Black-owned", "LGBTQ+ affirming", "Vegan options"
  slug: string,           // e.g. "lgbtq-affirming", "vegan"
  category: string,       // grouping: "Identity", "Dietary", "Accessibility", "Vibe"
  active: boolean,
  adminOnly: boolean,     // if true, only admin can assign (not self-service)
  createdAt: timestamp,
  usageCount: number      // denormalized count, updated on business save
}
```

## Business schema addition (lib/types.ts)
```
tags: string[];  // array of tag slugs e.g. ["black-owned", "vegan", "lgbtq-affirming"]
```

## Seed tags (write to Firestore on first deploy)
Identity: "Black-owned" (admin-only, all businesses), "LGBTQ+ affirming", "Woman-owned",
          "Veteran-owned", "Minority-owned"
Dietary: "Vegan options", "Vegetarian", "Gluten-free", "Halal", "Soul food"
Vibe: "Family-friendly", "Date night", "Live music", "Outdoor seating", "Late night"
Accessibility: "Wheelchair accessible", "ASL friendly"
Service: "Delivery", "Takeout", "Catering", "Appointment only"

## Public directory — tag filter
- Add a tag filter row below the main filters (collapsible on mobile)
- Show active tags as pill buttons (multi-select — any selected tags must ALL match
  OR any match, depending on toggle "Match all" / "Match any")
- Selected tags show with gold fill, unselected show outlined

## Public business profile page
- Show tags as pill badges below business name/category
- Each pill is clickable — links to /directory?tag={slug}

## Owner dashboard — tag editor
In the business editor form, add a "Tags" section:
- Grid of all active, non-adminOnly tags as toggleable pills
- Owner selects which apply to their business
- Save updates the tags[] array on their business doc

## Admin — tag management (/admin/tags)
New admin page with:
- List of all tags with: label, category, usageCount, active toggle, adminOnly toggle
- "Add tag" button → label, slug (auto-generated from label), category, adminOnly
- Edit / deactivate existing tags
- Deactivating a tag removes it from all business docs (batch update)
- "Merge tags" action: combine two tags into one (reassign + delete old)

## Firestore rules
```
match /business_tags/{tagId} {
  allow read: if true;
  allow write: if isAdmin();
}
```


================================================================================
PROMPT 12 — Professionals Directory (LinkedIn-style)
Repo: ezrarag/mkeblack
Priority: MEDIUM-LOW — Rick/Solana meeting request, plan now build later
================================================================================

Add a "Professionals" section — a people directory separate from the
business directory — for Black professionals in Milwaukee to be listed.

## Concept
Similar to the business directory but for individuals.
A professional can be listed whether or not they own a business.
They can be linked TO a business if they're an owner/employee.
This feeds BEAM's talent pipeline as well — professionals who are
BEAM participants can be flagged as available for project work.

## New Firestore collection: professionals
```
{
  id: string,
  uid: string | null,           // Firebase UID if they have an MKE Black account
  name: string,
  headline: string,             // e.g. "Full-stack developer & entrepreneur"
  bio: string,
  photoUrl: string,
  location: string,             // neighborhood or "Milwaukee, WI"
  industries: string[],         // e.g. ["Tech", "Marketing", "Finance"]
  skills: string[],             // free-form, e.g. ["React", "Brand Strategy"]
  linkedinUrl: string,
  websiteUrl: string,
  instagramUrl: string,
  businessId: string | null,    // link to a business in the directory
  beamParticipant: boolean,     // BEAM Institute flag
  openToWork: boolean,          // "Open to opportunities"
  openToCollaboration: boolean,
  active: boolean,
  verified: boolean,            // admin-verified profile
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Pages

### Public: /professionals
- Search bar (name, headline, skills)
- Filter: Industry | Open to work | BEAM participants | Neighborhood
- Card grid: photo, name, headline, top 3 skills as tags, "Open to work" badge
- Click card → /professionals/[id]

### Public: /professionals/[id]
- Full profile: photo, name, headline, bio
- Skills as pills
- Industry tags
- Links: LinkedIn, website, Instagram
- Business link: "Also owner of [Business Name]" → links to business directory listing
- BEAM badge if applicable
- Contact button (if they opt in): opens a simple contact form

### Self-registration: /professionals/new
- Any signed-in user (consumer or business role) can create a profile
- Form: name, headline, bio, photo upload, industry (multi-select), skills (free text chips),
  LinkedIn URL, website, Instagram, open-to-work toggle, open-to-collaboration toggle
- On save: writes to professionals collection, active: true, verified: false

### Dashboard integration
Business owners who sign in at /dashboard see a second tab: "My professional profile"
Links to their /professionals/[id] page or prompts them to create one.

### Admin: /admin/professionals
- List all professional profiles
- Verify / unverify / deactivate
- Link professional to a business (set businessId)
- Set beamParticipant flag
- Filter: verified / unverified / BEAM

## Connection to BEAM (future)
The beamParticipant flag + openToWork flag on professionals
can be read by the BEAM Transportation site and RAG platform
to surface available talent for client projects.
Keep this in mind when designing — the professionals collection
should be readable cross-project.

## Firestore rules
```
match /professionals/{professionalId} {
  allow read: if resource.data.active == true || isAdmin();
  allow create: if request.auth != null;
  allow update: if isAdmin() ||
    (request.auth != null && request.auth.uid == resource.data.uid);
  allow delete: if isAdmin();
}
```

## Important UX notes from meeting
- This is NOT a job board — it's a discovery/visibility tool
- Think LinkedIn profile page, not Indeed listing
- Professionals should feel proud to be listed — high visual quality
- The "Open to work" badge should be subtle, not desperate-feeling
- BEAM participants get a distinct but tasteful badge
- Long-term: professionals can endorse each other's skills (Phase 2)


================================================================================
SUMMARY — WHAT TO RUN AND IN WHAT ORDER
================================================================================

After current Prompts 1-7 (already queued):

8.  Near Me + Neighborhood GIS + Map improvements     ← run first, Rick wants this
9.  Hours scrub via Google Places API                 ← run second, data quality
10. Owner profile + team section                      ← run third, Solana's idea
11. Tags system                                       ← run fourth
12. Professionals directory                           ← run last, biggest lift

Notes:
- Prompts 8 and 9 require NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to be set in Vercel
  (Google Places API uses same key as Maps — enable "Places API" in Google Cloud Console)
- Prompt 12 (Professionals) should be architected so the `professionals` Firestore
  collection is readable by the BEAM transportation site — plan the rules accordingly
- All prompts: run `npx tsc --noEmit && npm run lint && npm run build` at end
