################################################################################
#
#   MKE BLACK — RICK FEEDBACK SPRINT (June 2026 call)
#   Source: Rick Banks call notes + Google Meet transcript summary
#   Run in Codex against ezrarag/mkeblack
#
#   Run order: P-FIX1 → P-FIX2 → P-FIX3 → P-FIX4 (each is standalone)
#   Always finish each prompt with:
#     npx tsc --noEmit && npm run lint && npm run build
#
################################################################################


================================================================================
PROMPT P-FIX1 — Auth, Claiming & Groups Bug Fixes
Priority: HIGHEST — these are broken/confusing behaviors Rick hit live
================================================================================

Fix the following bugs and UX issues observed during a live admin session:

## 1. Google sign-in screen jumping
During Google sign-in (signInWithPopup), the underlying page visibly jumps
between routes before settling. Root cause: the auth state listener triggers
router.replace() multiple times as the user/profile load in stages
(user loads → redirect, then profile loads → redirect again).

Fix in components/auth/login-form.tsx and the auth provider:
- Only redirect ONCE, after BOTH user AND profile (role) are loaded
- Add a `profileLoading` state to the auth context separate from `loading`
- The login page should show a "Signing you in…" full-screen state while
  profile resolves, instead of rendering and re-routing mid-flight
- Guard the redirect useEffect: if (loading || profileLoading || !user) return;

## 2. Auto-approve business claims when email matches
Current behavior: every self-claim goes to pending_claims for manual admin
approval, even when the claimer's email exactly matches the email already
on the business record.

New behavior (in the claim flow — components/dashboard/business-claim-search.tsx
and/or the claim API):
- When a signed-in user claims a business:
  - IF user.email (case-insensitive) === business.email → INSTANT approval:
    - set ownerUid immediately
    - claimInviteStatus: "verified_email_match"
    - write to pending_claims with status: "auto_approved" (audit trail, not a queue item)
    - show success: "Verified! Your email matches this listing — you now manage it."
  - ELSE → current behavior: pending_claims doc with status "pending_verification",
    user can edit but admin sees it in the queue
- /admin/claims page: add a filter tab "Auto-approved" so admins can audit
  email-match approvals separately from the pending queue

## 3. Group owner can delete their group
In the groups feature, the group owner currently has no way to delete a group.
- Add a "Delete group" action in the group settings/management area
  (visible only to the group owner — check ownerUid === auth.uid)
- Confirm dialog: "Delete [group name]? This removes the group and all its
  posts for every member. This cannot be undone."
- On delete: remove the group doc + all subcollection docs (members, posts)
  using a batched delete
- Firestore rules: allow delete on groups/{groupId} only when
  resource.data.ownerUid == request.auth.uid || isAdmin()

## 4. Fix Firestore rules for group creation
Rick hit "request denied" errors creating groups during the call.
Audit firestore.rules for the groups collection:
- allow create: if signedIn() — any authenticated user can create a group
- The created doc must pass: request.resource.data.ownerUid == request.auth.uid
- Members subcollection: owner can add/remove members; members can remove themselves
- Verify rules deploy cleanly: firebase deploy --only firestore:rules


================================================================================
PROMPT P-FIX2 — Groups: Notifications & @Mentions
Priority: HIGH — visitor/member engagement features Rick requested
================================================================================

## 1. Notification system for visitor profiles in groups
New Firestore collection: users/{uid}/notifications/{notificationId}
{
  id: string,
  type: 'group_post' | 'group_mention' | 'group_invite' | 'group_event' | 'claim_update',
  title: string,
  body: string,
  href: string,            // deep link e.g. /groups/[id]
  read: boolean,
  createdAt: timestamp
}

Triggers (write notification docs when):
- A new post is made in a group the user belongs to → type 'group_post'
  (batch-write one notification per member except the author)
- The user is @mentioned in a post → type 'group_mention'
- The user is invited to a group → type 'group_invite'
- An event is created in their group → type 'group_event'

UI:
- Bell icon in the site header (next to avatar) with unread count badge
- Click → dropdown showing latest 10 notifications, "Mark all read" button
- Clicking a notification marks it read and navigates to href
- /visitor page: "Notifications" section showing full list

Notification preferences (users/{uid} doc field):
notificationPrefs: {
  groupPosts: boolean,     // default true
  mentions: boolean,       // default true
  invites: boolean,        // default true
  events: boolean          // default true
}
- Toggleable in the visitor account settings
- Check prefs before writing each notification type

Firestore rules:
match /users/{uid}/notifications/{notificationId} {
  allow read, update: if isSelf(uid);
  allow create: if signedIn();   // other users' actions create notifications
  allow delete: if isSelf(uid) || isAdmin();
}

## 2. @Mention a member in group posts
In the group post composer:
- Typing "@" opens an inline autocomplete of group members (name + avatar)
- Arrow keys + Enter or click to select
- Selected mention renders as a highlighted chip in the post text:
  store as markdown-like token: @[displayName](uid)
- On post save: parse mention tokens, write a 'group_mention' notification
  to each mentioned member (respecting their prefs)
- Rendered post: mention shows as gold-highlighted @Name, links to their
  member profile if public


================================================================================
PROMPT P-FIX3 — Events Tab + Solidarity Member Calendar Embed
Priority: HIGH — structural nav change + new member-facing integration
================================================================================

## 1. Events becomes its own top-level tab
- Move "Events" out of the Explore dropdown into primaryLinks in
  components/layout/site-header.tsx:
  primaryLinks = [Directory, Marketplace, Events]
- Remove Events from exploreLinks

## 2. "Setup" button placement
In the account dropdown (avatar menu), under the user's name/initials block:
- Add a "Setup" button directly beneath the name/email block, above the
  account links list
- Routes by role: admin → /admin, business → /dashboard, visitor → /visitor
- Label: "Account setup" with a gear icon

## 3. Event-to-website linking for Solidarity members
Goal: a Solidarity Circle member business (e.g. ReadyAimGo as test) can take
an MKE Black event and hook it into their own website.

### Per-event embed/export options
On each event detail page (/events/[id]) add a "Share & Embed" section
visible to signed-in Solidarity members:

a) "Add to calendar" links (public, everyone):
   - Google Calendar link (calendar.google.com/calendar/render?action=TEMPLATE&...)
   - .ics file download (generate client-side from event data)

b) "Embed on your website" (Solidarity members only):
   - Embeddable iframe snippet:
     <iframe src="https://[site]/embed/events/[id]" width="400" height="300" />
   - Create app/embed/events/[id]/page.tsx — a minimal, chrome-less event
     card (no header/footer/nav) styled for embedding
   - Copy-to-clipboard button for the snippet

c) "Event feed for your site" (Solidarity members only):
   - JSON feed endpoint: /api/events/feed?businessId=[their businessId]
     Returns upcoming public events as JSON (id, title, date, description,
     imageUrl, href) — CORS enabled for any origin
   - Also /api/events/feed.ics — full iCal feed of upcoming MKE Black events
     that members can subscribe to from Google Calendar / Apple Calendar
   - Show both URLs with copy buttons and a short "how to use" note

### Member gating
- Check the signed-in user's linked business has solidarityMember === true
- Non-members see the section with a lock + "Solidarity Circle members can
  embed events on their own websites" + Join CTA

## 4. "Report a closed business" (from transcript)
On public business profile pages, add a small "Report an issue" link:
- Options: "This business has closed" | "Wrong hours" | "Wrong address" | "Other"
- Optional text field + optional reporter email
- Writes to business_reports/{id}: { businessId, businessName, reason, detail,
  reporterEmail, status: 'new', createdAt }
- /admin: add "Reports" queue (can live as a tab in /admin/businesses)
  showing new reports with Resolve / Dismiss actions
- Resolving a "closed" report offers a one-click "Deactivate listing" action

Firestore rules:
match /business_reports/{reportId} {
  allow create: if true;            // public reporting, no auth required
  allow read, update, delete: if isAdmin();
}


================================================================================
PROMPT P-FIX4 — Marketplace Fixes + Front-end Entry Point Parity Audit
Priority: MEDIUM-HIGH — "fix the marketplace listing area!" + button parity
================================================================================

## 1. Marketplace listing area fixes
Audit and fix the marketplace listing flow end to end:
- /marketplace public page: verify listings render with photo, price,
  business name; fix any broken image, layout overflow, or empty states
- Business dashboard marketplace tab: verify add/edit/delete listing works,
  photo upload persists to Storage, price formats correctly (cents → $X.XX)
- /admin/marketplace: verify feature/deactivate toggles persist
- Fix any Firestore rules failures on marketplace_listings writes by owners
- Empty state for non-Solidarity businesses: explain Marketplace is a
  Solidarity Circle benefit, with Join CTA
- Add loading skeletons wherever listings load

## 2. Entry-point parity audit (admin actions ↔ front-end access)
Principle: every key action an admin can do on a record should have a
discoverable front-end entry point for the right audience. Audit and add
the missing ones:

For each item below, ADD the front-end entry point if missing:

a) CLAIM A BUSINESS
   - Business profile page (/business/[id]): if ownerUid is null, show
     "Own this business? Claim this listing" button → /claim/[id] or
     dashboard claim search
   - Directory cards: small "Unclaimed" indicator on hover for unclaimed
     listings (subtle, not noisy)

b) SUBMIT A NEW BUSINESS
   - Directory page: "Don't see a business? Submit it" link near search
   - Business profile 404/not-found state: same submit link

c) EDIT MY LISTING
   - Business profile page: if signed-in user IS the owner, show
     "Edit listing" button → /dashboard

d) SUGGEST AN EDIT (visitors)
   - Business profile page: "Suggest an edit" → reuses the business_reports
     flow from P-FIX3 with reason "Wrong hours"/"Wrong address"/"Other"

e) JOIN SOLIDARITY CIRCLE
   - Business dashboard: if business is not a Solidarity member, persistent
     upsell card linking to /membership
   - Marketplace + Jobs empty states: same CTA

f) EXTERNAL LINK BUTTONS (the "yelp button" note)
   - Business profile action row: render a button for EVERY populated link
     field — Website, Yelp, Google Maps directions, Instagram, Facebook,
     delivery links. If the field has a value, the button MUST appear;
     audit the current conditional rendering for fields that have data but
     no button (Rick saw a Yelp value with no Yelp button)
   - Add yelpUrl to the Business type + owner dashboard editor + admin editor
     if not already present

g) EVENTS
   - Business dashboard: "Create an event" entry (links to event creation
     with businessId pre-filled) for Solidarity members

## 3. Deliverable: parity matrix
Write the audit results to scripts/ENTRYPOINT_PARITY.md as a table:
| Action | Admin path | Front-end path | Status (existed/added) |
so we can show Rick exactly what was added and where.

================================================================================
END — after all four prompts, deploy:
  git add -A && git commit -m "feat: rick feedback sprint" && git push
  firebase deploy --only firestore:rules
================================================================================
