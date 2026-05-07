/**
 * Recent views: persisted to localStorage always; synced to
 * users/{uid}/recent_views/{businessId} when the user is signed in.
 */

import { Business } from "@/lib/types";

const LS_KEY = "mkeblack_recent_views";
const MAX_VIEWS = 20;

export type RecentViewRecord = {
  businessId: string;
  businessName: string;
  businessCategory: string;
  businessAddress: string;
  businessPhotoUrl: string;
  viewedAt: string; // ISO string for localStorage
};

export function getLocalRecentViews(): RecentViewRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as RecentViewRecord[]) : [];
  } catch {
    return [];
  }
}

export function addLocalRecentView(business: Business): void {
  if (typeof window === "undefined") return;
  const existing = getLocalRecentViews().filter(
    (v) => v.businessId !== business.id
  );
  const next: RecentViewRecord = {
    businessId: business.id,
    businessName: business.name,
    businessCategory: business.category,
    businessAddress: business.address,
    businessPhotoUrl: business.photos[0] ?? "",
    viewedAt: new Date().toISOString()
  };
  const updated = [next, ...existing].slice(0, MAX_VIEWS);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota errors
  }
}

/** Persist a single view to Firestore (fire-and-forget). */
export async function persistRecentView(uid: string, business: Business) {
  try {
    const { getFirebaseDb, loadFirebaseFirestoreModule } = await import(
      "@/lib/firebase/client"
    );
    const [firestoreModule, db] = await Promise.all([
      loadFirebaseFirestoreModule(),
      getFirebaseDb()
    ]);
    if (!db) return;
    await firestoreModule.setDoc(
      firestoreModule.doc(db, "users", uid, "recent_views", business.id),
      {
        businessId: business.id,
        businessName: business.name,
        businessCategory: business.category,
        businessAddress: business.address,
        businessPhotoUrl: business.photos[0] ?? "",
        viewedAt: firestoreModule.serverTimestamp()
      }
    );
  } catch {
    // Best-effort; never block the user
  }
}
