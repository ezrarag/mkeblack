# MKE Black

MKE Black is a Next.js 14 App Router web app for [mkeblack.org](https://mkeblack.org), built as a Milwaukee Black business directory with realtime Firebase-backed listings, owner editing, and admin controls.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Firebase Auth
- Firestore
- Firebase Storage
- Google Maps JavaScript API
- Vercel-ready deployment

## Included Features

- Public directory at `/`
- Search by name, category, address, or description
- Day-open filter for Monday through Sunday
- Category filter
- Grid/list toggle
- Google Maps pin view toggle
- Public business profile page at `/business/[id]`
- Business login at `/login`
- Owner dashboard at `/dashboard`
- Realtime Firestore updates
- Photo upload to Firebase Storage
- Admin workspace at `/admin`
- Admin add/edit/deactivate listing flow

## Routes

- `/`
  Public Milwaukee Black business directory with realtime filters and map pins.
- `/business/[id]`
  Full business profile with gallery, hours, contact details, and map.
- `/login`
  Firebase email/password login for business owners and admins.
- `/dashboard`
  Owner-only listing editor with hours, content, and photo upload controls.
- `/admin`
  Admin management area for all listings, including manual creation and deactivation.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in your Firebase and Google Maps values in `.env.local`.

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

These same variables should be added in Vercel for production.

## Firebase Setup

### 1. Enable Firebase services

In the Firebase console, enable:

- Authentication
  Enable Email/Password sign-in.
- Firestore Database
  Create the database in production mode or test mode, then deploy the rules below.
- Storage
  Create the default bucket and deploy the storage rules below.

### 2. Deploy Firebase rules

This repo includes:

- `firestore.rules`
- `storage.rules`

Deploy them with the Firebase CLI after connecting your project:

```bash
firebase deploy --only firestore:rules,storage
```

### 3. Firestore collections

#### `businesses`

Each document follows this shape:

```ts
{
  id: string,
  name: string,
  category: string,
  description: string,
  address: string,
  phone: string,
  website: string,
  hours: {
    monday: { open: string, close: string, closed: boolean },
    tuesday: { open: string, close: string, closed: boolean },
    wednesday: { open: string, close: string, closed: boolean },
    thursday: { open: string, close: string, closed: boolean },
    friday: { open: string, close: string, closed: boolean },
    saturday: { open: string, close: string, closed: boolean },
    sunday: { open: string, close: string, closed: boolean }
  },
  photos: string[],
  ownerUid: string,
  active: boolean,
  location: {
    lat: number,
    lng: number
  }
}
```

#### `users`

Use the Firebase Auth UID as the document id:

```ts
{
  uid: string,
  email: string,
  role: "business" | "admin",
  businessId: string
}
```

### 4. Owner setup

For each business owner:

1. Create a Firebase Auth user with email/password.
2. Create a `users/{uid}` document.
3. Set `role: "business"`.
4. Set `businessId` to the matching `businesses/{id}` document.
5. Set the business document's `ownerUid` to the same UID.

Once those links exist, the owner will only see their listing in `/dashboard`.

### 5. Admin setup

The app checks Firebase custom claims and also supports an admin role document for smoother local setup.

For a true admin account, do both:

1. Set `users/{uid}.role = "admin"`
2. Set a Firebase custom claim:

```js
admin.auth().setCustomUserClaims(uid, { admin: true });
```

Custom claims must be set from a trusted environment such as a Firebase Admin SDK script, Cloud Function, or internal admin tool.

## Auth and Security Model

The included rules enforce:

- Public users can read active businesses
- Business owners can read and update only their own listing
- Admins can read and write all businesses
- Users can read and update their own user document
- Admins can manage user documents
- Storage uploads under `businesses/{businessId}/...` are limited to the owner of that listing or an admin

## Notes on Maps

- The directory map and business map use the Google Maps JavaScript API.
- Address edits attempt to re-geocode automatically when a listing is saved.
- If geocoding is not enabled for the provided Google Maps API key, the previous coordinates are preserved.

## Local Verification

The project was verified with:

```bash
npm run lint
npm run build
```

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the project into Vercel.
3. Add the environment variables from `.env.example`.
4. Deploy.

No custom Vercel configuration is required.

## File Highlights

- `app/`
  App Router pages and layout
- `components/directory/`
  Public browsing UI
- `components/dashboard/`
  Owner dashboard UI
- `components/admin/`
  Admin management UI
- `components/forms/`
  Shared listing editor and hours editor
- `lib/firebase/`
  Firebase client and listing mutation helpers
- `hooks/`
  Realtime Firestore hooks

## Recommended Seed Data Flow

To get the app usable quickly:

1. Create a few `businesses` documents in Firestore with `active: true`.
2. Create matching Auth users for owners.
3. Add `users/{uid}` documents with `businessId`.
4. Sign in through `/login`.
5. Confirm owner edits appear instantly on `/`.
