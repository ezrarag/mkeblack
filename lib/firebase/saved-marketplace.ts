import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { MarketplaceListing, SavedMarketplaceListing } from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (
    isRecord(value) &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return null;
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

export function normalizeSavedMarketplaceListing(
  data: unknown,
  listingId: string
): SavedMarketplaceListing {
  const record = isRecord(data) ? data : {};
  return {
    listingId: stringValue(record.listingId, listingId).trim() || listingId,
    businessId: stringValue(record.businessId).trim(),
    businessName: stringValue(record.businessName).trim(),
    name: stringValue(record.name).trim(),
    description: stringValue(record.description).trim(),
    priceCents: numberValue(record.priceCents, 0),
    photoUrl: stringValue(record.photoUrl).trim(),
    category: stringValue(record.category, "Other").trim(),
    orderUrl: stringValue(record.orderUrl).trim(),
    savedAt: parseDateValue(record.savedAt)
  };
}

export async function saveMarketplaceListingForUser(
  uid: string,
  listing: MarketplaceListing
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.setDoc(
    firestoreModule.doc(db, "users", uid, "saved_marketplace", listing.id),
    {
      listingId: listing.id,
      businessId: listing.businessId,
      businessName: listing.businessName,
      name: listing.name,
      description: listing.description,
      priceCents: listing.priceCents,
      photoUrl: listing.photoUrl,
      category: listing.category,
      orderUrl: listing.orderUrl,
      savedAt: firestoreModule.serverTimestamp()
    }
  );
}

export async function removeSavedMarketplaceListing(
  uid: string,
  listingId: string
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.deleteDoc(
    firestoreModule.doc(db, "users", uid, "saved_marketplace", listingId)
  );
}
