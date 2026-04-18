# CODEX PROMPT — Google Workspace Admin Integration
# Add this after the migration prompt (Prompt 3) is complete.
# Run in the mkeblack repo.

Add a Google Workspace integration tab to the MKE Black admin area.
This gives MKE Black admins a way to view their Gmail, Google Drive, and
Google Calendar directly inside the admin dashboard — so they can coordinate
events, find the Excel file, and manage communications without leaving the app.

## Auth Setup

Use the existing Google Sign-In already configured in Firebase Auth.
When an admin signs in with Google, we get an OAuth access token that can
call Google APIs on their behalf. Store the token in memory (React state)
and use it for all Google API calls during the session.

In app/providers.tsx (or auth context), after Google sign-in succeeds:
- Capture the Google OAuth credential from the UserCredential
- Store the accessToken in a React context (GoogleTokenContext)
- Expose useGoogleToken() hook for Google API calls

## New Page: /admin/workspace

File: app/admin/workspace/page.tsx
Component: components/admin/workspace/workspace-page.tsx

Three tabs: Gmail | Drive | Calendar

### Tab 1 — Gmail

Use: https://gmail.googleapis.com/gmail/v1/users/me/messages

- Fetch last 30 message threads (list then batch-get subjects/senders)
- Show table: From | Subject | Date | Snippet
- Filter bar: search by keyword, filter by label (Inbox, Sent, Unread)
- Click thread → expand to show full message body (fetch single message)
- "Mark as Read" button (PATCH to modify labels)
- Urgency badge: auto-tag messages containing keywords like "urgent", "ASAP",
  "help", "issue" as 🔴 High; "question", "update" as 🟡 Medium; rest 🟢 Normal

### Tab 2 — Drive

Use: https://www.googleapis.com/drive/v3/files

- List files in root (pageSize: 50, orderBy: modifiedTime desc)
- Show: icon by mimeType | Name | Modified | Size
- Folder navigation: click folder → drill in, breadcrumb trail back
- Search bar: queries Drive files by name
- File actions:
  - Google Sheets/Excel (.xlsx): show "Import to Directory" button →
    navigates to /admin/import with the Drive file pre-selected
    (pass fileId as query param, fetch file as ArrayBuffer for SheetJS)
  - Any file: "Open in Drive" → opens drive.google.com link in new tab
- Highlight .xlsx and .csv files with a green badge ("Importable")

### Tab 3 — Calendar

Use: https://www.googleapis.com/calendar/v3/calendars/primary/events

- Show next 30 days of events (timeMin: now, timeMax: +30 days)
- Calendar grid view (week view) OR simple list view toggle
- Each event card: title, date/time, location, description snippet
- "Create Event" slide-over:
  - Fields: title, date, start time, end time, location, description
  - On submit: POST to Calendar API to create event
  - Useful for scheduling MKE Black events directly from admin

## Firestore Caching (optional, add if API quota is a concern)

Collections already defined in firestore.rules: gw_gmail, gw_calendar, gw_drive
After each API fetch, write results to these collections with a `cachedAt` timestamp.
On next load, if cachedAt is less than 5 minutes ago, read from Firestore instead of API.
Admin can click "Refresh" to force a fresh API pull.

## UI/UX

- Tab bar at top of /admin/workspace page
- Each tab has a loading skeleton while fetching
- If Google token is not available (admin signed in with email/password not Google):
  show a "Connect Google Account" button that triggers GoogleAuthProvider sign-in
  and merges accounts (linkWithPopup)
- All three tabs respect the dark tactical aesthetic of the rest of the admin area
- Use Tailwind classes consistent with existing admin components

## Required Google API Scopes (add to GoogleAuthProvider config)

In the component or auth setup where GoogleAuthProvider is configured, add:
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar');

These scopes will be requested during the Google sign-in consent screen.
No backend needed — all calls are made client-side with the user's own token.

## File: components/admin/workspace/gmail-tab.tsx
## File: components/admin/workspace/drive-tab.tsx
## File: components/admin/workspace/calendar-tab.tsx
## File: components/admin/workspace/workspace-page.tsx
## File: app/admin/workspace/page.tsx
## File: lib/google-workspace.ts  (fetch helpers for Gmail, Drive, Calendar)
## File: hooks/use-google-token.ts (context hook for OAuth token)

Add "Workspace" link to the admin sidebar/nav.
