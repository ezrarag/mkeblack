import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import {
  MarketplaceListing,
  MarketplaceListingFormValues,
  MarketplaceOrder,
  RevenueShareLedgerEntry
} from "@/lib/types";
import { normalizeUrl } from "@/lib/utils";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
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
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  return null;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

async function getStorageHelpers() {
  const [storageModule, storage] = await Promise.all([
    loadFirebaseStorageModule(),
    getFirebaseStorage()
  ]);
  if (!storage) throw new Error("Firebase Storage is not available.");
  return { storage, storageModule };
}

export function normalizeMarketplaceListing(
  value: unknown,
  id: string
): MarketplaceListing {
  const record = isRecord(value) ? value : {};
  return {
    id,
    businessId: stringValue(record.businessId).trim(),
    businessName: stringValue(record.businessName).trim(),
    businessSolidarity: booleanValue(record.businessSolidarity, false),
    name: stringValue(record.name).trim(),
    description: stringValue(record.description).trim().slice(0, 600),
    priceCents: numberValue(record.priceCents, 0),
    photoUrl: stringValue(record.photoUrl).trim(),
    category: stringValue(record.category, "Other").trim(),
    available: booleanValue(record.available, true),
    featured: booleanValue(record.featured, false),
    checkoutMode: record.checkoutMode === "native" ? "native" : "external",
    orderUrl: stringValue(record.orderUrl).trim(),
    createdAt: parseDateValue(record.createdAt),
    updatedAt: parseDateValue(record.updatedAt)
  };
}

export function normalizeMarketplaceOrder(
  value: unknown,
  id: string
): MarketplaceOrder {
  const record = isRecord(value) ? value : {};

  return {
    id,
    listingId: stringValue(record.listingId).trim(),
    listingName: stringValue(record.listingName).trim(),
    businessId: stringValue(record.businessId).trim(),
    businessName: stringValue(record.businessName).trim(),
    customerUid: stringValue(record.customerUid).trim() || null,
    customerEmail: stringValue(record.customerEmail).trim(),
    amountCents: numberValue(record.amountCents, 0),
    platformFeeCents: numberValue(record.platformFeeCents, 0),
    netToBusinessCents: numberValue(record.netToBusinessCents, 0),
    stripeCheckoutSessionId: stringValue(record.stripeCheckoutSessionId).trim(),
    stripeCustomerId: stringValue(record.stripeCustomerId).trim(),
    stripePaymentStatus: stringValue(record.stripePaymentStatus).trim(),
    status:
      record.status === "paid" || record.status === "cancelled"
        ? record.status
        : "pending",
    createdAt: parseDateValue(record.createdAt),
    paidAt: parseDateValue(record.paidAt)
  };
}

export function normalizeRevenueShareLedgerEntry(
  value: unknown,
  id: string
): RevenueShareLedgerEntry {
  const record = isRecord(value) ? value : {};

  return {
    id,
    orderId: stringValue(record.orderId).trim() || id,
    businessId: stringValue(record.businessId).trim(),
    businessName: stringValue(record.businessName).trim(),
    saleAmountCents: numberValue(record.saleAmountCents, 0),
    platformFeeCents: numberValue(record.platformFeeCents, 0),
    netToBusinessCents: numberValue(record.netToBusinessCents, 0),
    status: record.status === "paid_out" ? "paid_out" : "pending_payout",
    createdAt: parseDateValue(record.createdAt),
    paidOutAt: parseDateValue(record.paidOutAt)
  };
}

/**
 * Create or update a listing from the owner dashboard.
 * `featured` is never touched here — only admins can feature a listing.
 */
export async function saveMarketplaceListing(
  businessId: string,
  businessName: string,
  businessSolidarity: boolean,
  listingId: string | null,
  values: MarketplaceListingFormValues
): Promise<string> {
  if (!businessSolidarity) {
    throw new Error("Marketplace listings are only available to Solidarity Circle businesses.");
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const collRef = firestoreModule.collection(db, "marketplace_listings");
  const ref = listingId
    ? firestoreModule.doc(db, "marketplace_listings", listingId)
    : firestoreModule.doc(collRef);

  const now = firestoreModule.serverTimestamp();
  const existing = listingId ? await firestoreModule.getDoc(ref) : null;

  // Use updateDoc for existing docs (preserves featured flag set by admin);
  // setDoc for new docs.
  const payload = {
    id: ref.id,
    businessId,
    businessName,
    businessSolidarity,
    name: values.name.trim(),
    description: values.description.trim().slice(0, 600),
    priceCents: Math.max(0, Math.round(Number(values.priceCents) || 0)),
    photoUrl: values.photoUrl.trim(),
    category: values.category.trim() || "Other",
    available: Boolean(values.available),
    checkoutMode: values.checkoutMode,
    orderUrl: normalizeUrl(values.orderUrl.trim()),
    updatedAt: now
  };

  if (existing?.exists()) {
    await firestoreModule.updateDoc(ref, payload);
  } else {
    await firestoreModule.setDoc(ref, {
      ...payload,
      featured: false,
      createdAt: now
    });
  }

  return ref.id;
}

export async function deleteMarketplaceListing(
  listingId: string,
  photoUrl: string
) {
  const [{ db, firestoreModule }, storage] = await Promise.all([
    getFirestoreHelpers(),
    getFirebaseStorage()
  ]);

  if (storage && photoUrl) {
    try {
      const { storageModule } = await getStorageHelpers();
      await storageModule.deleteObject(storageModule.ref(storage, photoUrl));
    } catch {
      // Best-effort cleanup — proceed regardless
    }
  }

  await firestoreModule.deleteDoc(
    firestoreModule.doc(db, "marketplace_listings", listingId)
  );
}

export async function adminUpdateListing(
  listingId: string,
  updates: {
    category?: string;
    orderUrl?: string;
    checkoutMode?: "external" | "native";
    featured?: boolean;
    available?: boolean;
  }
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "marketplace_listings", listingId),
    { ...updates, updatedAt: firestoreModule.serverTimestamp() }
  );
}

export async function uploadMarketplaceListingPhoto(
  businessId: string,
  file: File
): Promise<string> {
  const { storage, storageModule } = await getStorageHelpers();
  const timestamp = Date.now();
  const storageRef = storageModule.ref(
    storage,
    `businesses/${businessId}/marketplace/${timestamp}-${sanitizeFilename(
      file.name
    )}`
  );
  const snapshot = await storageModule.uploadBytes(storageRef, file);
  return storageModule.getDownloadURL(snapshot.ref);
}
