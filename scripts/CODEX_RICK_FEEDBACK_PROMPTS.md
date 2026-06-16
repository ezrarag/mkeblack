################################################################################
#
#   MKE BLACK — RICK FEEDBACK SPRINT (June 2026 call)
#   Source: Live call with Rick Banks + transcript summary + Ezra's notes
#   Run prompts in order. Each is self-contained for one Codex session.
#
#   Context for Codex: Next.js 14 App Router, Firebase Auth/Firestore/Storage,
#   Tailwind. Existing features: directory, groups, events, marketplace,
#   visitor profiles, claims (admin invite + self-claim + pending_claims
#   admin queue), Stripe membership. Read existing code before modifying —
#   these prompts describe desired END STATE, adapt to what exists.
#
################################################################################


================================================================================
PROMPT R1 — Auth UX: Stop the screen jumping on Google sign-in
Priority: HIGH — first thing Rick noticed
================================================================================

## The bug
When a user signs in with Google (signInWithPopup), the screen visibly
"jumps from one open page to another" — multiple redirects fire in sequence.

## Likely causes to investigate and fix
1. The login form has a useEffect that redirects on `user` change, AND the
   popup resolution ALSO triggers navigation — double navigation race.
2. The auth provider re-renders with loading → user → profile-loaded states,
   and the redirect fires on the intermediate state (user exists but profile/
   role not yet loaded), sending the user to /dashboard, then the role loads
   and a second redirect sends admins to /admin.

## Fix requirements
- Redirect ONCE, only after BOTH user AND profile (role) are loaded.
- In the login form's redirect useEffect: guard with
  `if (loading || !user || profileLoading) return;`
  (add a profileLoading flag to the auth provider if it doesn't exist).
- Never call router.replace more than once per sign-in — use a hasRedirected
  ref to guarantee single navigation.
- While waiting for profile load after popup success, show an inline
  "Signing you in…" state on the login page instead of navigating early.
- Test all three roles: admin → /admin, business → /dashboard,
  visitor → /visitor (respect ?next= param when present and safe).


================================================================================
PROMPT R2 — Groups: delete, notifications, @mentions
Priority: HIGH — Rick explicitly requested all three
================================================================================

## A) Group owner can delete their group
- On the group page (app/groups/[groupId]), if current user is the group
  owner (or admin): show a "Delete group" action in a settings/⋯ menu.
- Confirm dialog: "Delete [group name]? This removes all posts and members.
  This cannot be undone." Require typing the group name OR a two-step confirm.
- On delete: remove the group doc, its members subcollection, and posts
  subcollection (batched deletes; if large, delete in chunks of 400).
- Firestore rules: allow delete on groups/{groupId} only for owner or admin.
- After delete: redirect to /groups with a toast "Group deleted."

## B) Notification types for visitor profiles in a group
Create a notifications system scoped to group activity.

### Firestore: users/{uid}/notifications/{notificationId}
{
  id, type: 'group_post' | 'group_mention' | 'group_event' | 'group_member_joined',
  groupId, groupName,
  actorUid, actorName,        // who triggered it
  targetId,                   // postId / eventId etc.
  text,                       // preview snippet
  read: boolean,
  createdAt: timestamp
}

### Notification preferences on the visitor profile
users/{uid}.notificationPrefs = {
  group_post: boolean,        // new posts in my groups
  group_mention: boolean,     // someone @mentioned me
  group_event: boolean,       // event created in my group
  group_member_joined: boolean
}
Default all true. Add a "Notifications" section to the /visitor profile
page with toggles for each type.

### Writing notifications
When a post/event/member-join happens in a group, fan out a notification
doc to each group member (except the actor) whose pref for that type is true.
Do this client-side in the same action for now (batch write); note in a
code comment that this should move to a Cloud Function at scale.

### Notification UI
- Bell icon in the site header (only when signed in) with unread count badge.
- Dropdown panel: list of recent notifications, newest first, unread bold.
- Click → marks read + navigates to the group/post.
- "Mark all read" button.
- Firestore rules: users can read/write only their own notifications subcollection.

## C) @mention a member of a group
- In the group post composer (and comment composer if present), typing "@"
  opens an inline autocomplete of the group's members (name + avatar).
- Selecting inserts a mention token; store post text with a markup like
  @[displayName](uid) and render mentions as accent-colored links to the
  member's visitor profile.
- On post save: parse mentions, write a 'group_mention' notification to each
  mentioned member (respecting their prefs).
- Keyboard support: arrow keys + enter to select; esc to dismiss.


================================================================================
PROMPT R3 — Events: own tab + profile setup button + website embed for members
Priority: HIGH — includes the Solidarity member calendar hook-in
================================================================================

## A) Events becomes a top-level tab
- Move "Events" out of the Explore dropdown into the header's primaryLinks
  (next to Directory and Marketplace) so it reads:
  Directory | Marketplace | Events
- Keep /events route as-is; verify mobile Menu dropdown includes it.

## B) "Setup" button under the user's name in the avatar menu
- In the signed-in avatar dropdown, directly under the name/email block,
  add a compact "Account setup" button (gear icon) linking to a new
  /settings page (or /visitor#settings if simpler) where users manage:
  - Display name + avatar
  - Notification preferences (from Prompt R2-B)
  - Email
- Rick's words: "setup should be a button under the name under the initials"
  — placement matters: inside the dropdown card that shows the account info.

## C) Event → external website embedding (Solidarity member feature)
Goal: a Solidarity Circle member org (e.g. ReadyAimGo as test) creates an
event in MKE Black and can hook that event into THEIR OWN website.

### 1. Public event API (read-only JSON)
GET /api/events/[eventId]        → single event JSON
GET /api/events?businessId=xyz   → all upcoming events for a business
Response: id, title, description, date, endDate, address, photoUrl,
ticketUrl, free, businessId, businessName.
CORS: allow all origins (public data, active events only).

### 2. Embeddable widget
GET /embed/events/[businessId]   → a minimal standalone HTML page
(no site header/footer) rendering that business's upcoming events as
styled cards. Designed to be iframed:
<iframe src="https://mkeblack.org/embed/events/BUSINESS_ID"
        style="width:100%;border:0;" height="420"></iframe>
- Light/dark via ?theme=light|dark query param.
- "Powered by MKE Black" footer link (drives traffic back).

### 3. ICS calendar feed
GET /api/events/[businessId]/calendar.ics
→ standard iCalendar feed of the business's upcoming events so members
can subscribe from Google Calendar / Apple Calendar ("scaffold the calendar").
Use the `ics` npm package or hand-build the VCALENDAR text.

### 4. "Share & embed" panel on event management
Where a business owner manages their events (dashboard) and on the admin
event editor, add a "Share & embed" section showing copy-paste blocks for:
- Direct link to the event page
- The iframe embed snippet (pre-filled with their businessId)
- The ICS subscription URL
Gate the embed + ICS blocks behind solidarityMember === true with an
upsell note for non-members: "Embedding is a Solidarity Circle benefit."


================================================================================
PROMPT R4 — Claims: auto-approve on email match + closed-business reports
Priority: HIGH — removes admin friction Rick called out
================================================================================

## A) Auto-approve self-claims when emails match
Current behavior: every self-claim goes to pending_claims for manual review.

New behavior in the self-claim flow (business-claim-search):
- If the signed-in user's auth email (case-insensitive) matches the
  business doc's email field → claim is AUTO-APPROVED:
  - set ownerUid, claimInviteStatus: 'claimed' on the business
  - set businessId on users/{uid}
  - write pending_claims doc with status: 'auto_approved' (audit trail)
  - UI: "✓ Verified — this listing is yours. You can edit it now."
- If emails do NOT match → existing pending_verification flow, with
  clear UI copy: "Your claim was sent to MKE Black for verification
  because your account email doesn't match the one on this listing."
- /admin/claims: add an "Auto-approved" filter tab so admins can audit;
  admins can still revoke (existing reject flow).

## B) "Report this business" (closed / wrong info)
- On the public business profile page, add a low-key "Report an issue"
  link (footer of the page).
- Modal with reason select: "Business has closed" | "Wrong hours" |
  "Wrong address/phone" | "Other" + optional comment + optional email.
  No sign-in required.
- Writes to business_reports/{id}: { businessId, businessName, reason,
  comment, reporterEmail, status: 'open', createdAt }.
- Admin: /admin/reports page listing open reports; actions per report:
  "Deactivate business" (sets active:false), "Mark resolved", "Dismiss".
- Badge count of open reports on the admin workspace home.
- Firestore rules: anyone can create; only admin can read/update/delete.


================================================================================
PROMPT R5 — Marketplace listing area fix + entry-point audit
Priority: HIGH — "fix the marketplace listing area!" (Rick, emphatically)
================================================================================

## A) Marketplace listing area
Audit and repair the marketplace flows end to end:
1. /marketplace public page: listings render with photo, name, business,
   price; broken image fallback; empty state with CTA; filters work.
2. Business dashboard marketplace tab: owner can create/edit/deactivate
   their listings; photo upload to Storage works; solidarityMember gate
   shows a friendly upsell (not an error) for non-members.
3. /admin/marketplace: admin sees ALL listings, can feature/deactivate.
4. Firestore rules for marketplace_listings match these flows (public read
   when available:true; owner create/update own; admin everything).
5. Fix any console errors, permission-denied reads, or dead buttons in
   these three surfaces. Run the flows mentally and patch every gap.
(Also note for roadmap, do NOT build now: mobile app photo capture that
auto-creates marketplace listings — coming in the iOS app.)

## B) Entry-point audit — admin actions need public/owner twins
Rick's note: actions exist in admin but lack the corresponding button on
the front end (example given: a Yelp-style action with no public twin;
claiming is barely discoverable).

Sweep the app and add these missing entry points:

1. CLAIM — on every unclaimed business profile page (ownerUid == null),
   show a visible "Own this business? Claim this listing" button →
   signed-out: /login?next=/claim-search; signed-in: the claim search
   prefilled with that business. Also add a "Claim your business" link
   in the site footer.
2. EDIT — when the signed-in owner views their OWN public business page,
   show an "Edit listing" button → /dashboard. When an admin views any
   business page, show "Edit as admin" → /admin/businesses/[id].
3. ADD A BUSINESS — "Add your business" CTA on the directory page
   (empty results state AND a persistent small button near filters) →
   the public submission flow.
4. EVENTS — business owners: "Add event" from their dashboard; the public
   /events page gets a "Hosting something? Submit your event" CTA
   (solidarity members → direct create; others → contact form).
5. MARKETPLACE — owner dashboard gets a "View my public listings" link;
   each public listing links back to the business profile.
6. REPORT — the "Report an issue" link from Prompt R4-B counts as the
   public twin of admin deactivation.
Deliverable: a short ENTRY_POINTS.md in scripts/ listing every admin
action and its public/owner twin, marking which were added in this sprint.


================================================================================
SUGGESTED RUN ORDER
================================================================================
R1 (auth jump — small, do first)
R4 (claims auto-approve — small/medium, big friction win)
R5 (marketplace fix + entry points — medium)
R3 (events tab + embeds — medium/large)
R2 (groups notifications + mentions — largest, do last)

After each: npx tsc --noEmit && npm run lint && npm run build
Then: firebase deploy --only firestore:rules --project mkeblack-c6dfe
(rules change in R2, R4, R5)
################################################################################
