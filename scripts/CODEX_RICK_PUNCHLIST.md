################################################################################
#
#   MKE BLACK — RICK PUNCH-LIST (June 2026)
#   Quick-polish fixes from Rick's review. Items #1 and #7 are ALREADY DONE
#   directly (run: node scripts/patch-rick-punchlist.js). Item #4 is a 30-second
#   admin task (no code). This packet covers the remaining four: #2, #3, #5, #6.
#
#   Stack: Next.js 14 App Router, Firebase/Firestore, Tailwind.
#   Read existing code before editing — these describe the desired END STATE.
#   After each: npx tsc --noEmit && npm run lint && npm run build
#
################################################################################


================================================================================
ALREADY HANDLED (for your tracking — do NOT redo)
================================================================================
#1  Flag-as-outdated moved next to Claim/Edit buttons → done in patch script
#4  "Senior Dining Program" tag → add via /admin/tags UI (no code, Ezra does it)
#7  Map no longer zooms out when selecting a business → done in patch script


================================================================================
PROMPT PL-2 — Capitalize all words in Explore page titles
Priority: LOW (cosmetic) · Effort: small
================================================================================

Rick: "Capitalize all the words in the explore pages titles."

The Explore section (the pages reachable from the header's Explore/primary nav —
Directory, Marketplace, Events, Who We Are, What We Do, News & Articles, Groups)
have page headings and/or nav labels that are not consistently Title Cased.

Task:
1. Audit the visible <h1>/page-title text and the header nav labels for every
   Explore destination. Find any that are lower-case or sentence-case.
2. Convert them to Title Case (capitalize the first letter of each significant
   word): e.g. "black-owned restaurants" → "Black-Owned Restaurants",
   "what we do" → "What We Do".
3. Prefer fixing the SOURCE STRINGS (so the casing is correct everywhere the
   string is used) rather than a CSS `capitalize` hack — CSS capitalize also
   uppercases words like "and"/"the" which Title Case usually leaves lower,
   and mishandles hyphenated/acronym words.
4. Keep acronyms intact (MKE, LGBTQ+) and keep small connector words
   (a, an, and, the, of, in, for) lower-case unless they are the first word.

Files to check (not exhaustive — sweep the app/ Explore routes and the header
nav component): app/directory, app/marketplace, app/events, app/who-we-are,
app/what-we-do, app/news-articles, app/groups, and components/layout/site-header.tsx.

Deliverable: every Explore page heading and nav label reads in proper Title Case.


================================================================================
PROMPT PL-3 — Stop expired events from accepting RSVPs
Priority: HIGH (looks broken in a demo) · Effort: medium
================================================================================

Rick: "The event on the event page is now out of date but still taking RSVPs."

Events have startsAt/endsAt timestamps and a status ("draft" | "published" |
"cancelled"), but nothing stops RSVP/ticket actions once the event date has
passed. Fix this end to end.

Task:
1. Add a helper isEventPast(event): boolean — true when the event's endsAt
   (or startsAt if endsAt is null) is before now.
2. On the public event page and event cards:
   - If isEventPast: hide/disable the RSVP and ticket-purchase controls and
     show a clear label: "This event has ended."
   - Visually de-emphasize past events (muted styling / "Ended" badge).
3. On the events listing page (/events):
   - Default to showing UPCOMING events first; move past events into a
     separate "Past events" section (or hide them behind a toggle).
   - Do not show RSVP buttons on any past event card.
4. Server/data guard: in the RSVP / ticket-order creation path
   (the EventTicketOrder create flow), reject creation when the event is past,
   so a stale page can't submit. Return a friendly error.
5. Optionally surface in admin: a small "Ended" indicator on past events in
   the admin events manager so staff can see at a glance.

Do NOT auto-delete past events — they stay as a historical record, just
non-interactive.


================================================================================
PROMPT PL-5 — Fix bulk-action buttons not lighting up on selection
Priority: MEDIUM (confusing UX) · Effort: small
================================================================================

Rick: "The 'Delete Selected' and 'Deactivate All' buttons don't light up when
you select things in the business manager. They function tho."

In the business manager (components/admin/business-management-page.tsx), the
bulk-action buttons stay visually disabled/greyed even when rows are selected,
although clicking them does work.

Task:
1. Find the selection state (e.g. selectedIds / selectedBusinessIds) and the
   bulk-action buttons ("Delete Selected", "Deactivate All", and any other
   bulk buttons in that toolbar).
2. Wire each button's `disabled` prop to the real selection count:
   disabled={selectedIds.length === 0}
3. Give the ENABLED state a clear active appearance (full color / accent),
   distinct from the disabled state (muted + cursor-not-allowed), so it's
   obvious when an action is available.
4. Show the selection count in the button or toolbar, e.g.
   "Delete Selected (3)" and "Deactivate Selected (3)", updating live.
5. After a bulk action completes, clear the selection so the buttons return
   to their disabled state.

Verify by selecting/deselecting rows — the buttons must visibly enable and
disable in step with the selection.


================================================================================
PROMPT PL-6 — Flag likely-duplicate businesses on add
Priority: MEDIUM · Effort: medium
================================================================================

Rick: "Have the system flag duplicate businesses if someone wants to add that
business again?"

When a business is submitted (public submission flow AND admin add-business),
warn if it looks like an existing listing before creating a duplicate.

Task:
1. Add a duplicate-check helper, e.g. findPossibleDuplicates(name, address):
   - Normalize for comparison: lowercase, trim, strip punctuation and common
     suffixes (LLC, Inc, the), collapse whitespace.
   - Match on normalized name exact/contains, and (when address present) a
     loose address match (same street number + street name).
   - Return up to ~5 candidate existing businesses.
2. Public submission flow: after the user enters name/address, before final
   submit, run the check. If candidates exist, show a non-blocking warning:
   "A business like this may already be listed:" with the candidate name(s)
   linking to their /business/[id], plus a "Claim this listing instead" link
   and a "No, this is different — continue" option. Do not hard-block.
3. Admin add-business: same check, shown inline; admin can proceed anyway
   (they may be intentionally adding a second location).
4. Keep it lightweight — a client-side query against the businesses the app
   already loads is fine; no new collection needed. Note in a comment that a
   server-side check could be added later for scale.

Goal: reduce accidental duplicates without preventing legitimate additions
(e.g. two locations of the same business).


================================================================================
RUN ORDER
================================================================================
First, outside Codex:
  - node scripts/patch-rick-punchlist.js   (does #1 and #7)
  - Add "Senior Dining Program" tag in /admin/tags  (#4)

Then in Codex, in this order:
  PL-5  bulk-action buttons      (small, high clarity win)
  PL-3  expired-event RSVPs      (high — avoids a broken-looking demo)
  PL-2  Title Case explore pages (cosmetic sweep)
  PL-6  duplicate detection      (medium logic)

After each: npx tsc --noEmit && npm run lint && npm run build
################################################################################
