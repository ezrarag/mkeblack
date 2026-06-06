import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import { BusinessReview, ReviewStatus } from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function photosValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function statusValue(value: unknown): ReviewStatus {
  return value === "flagged" || value === "removed" ? value : "published";
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

export function normalizeReview(data: FirestoreRecord, id: string): BusinessReview {
  return {
    id,
    businessId: stringValue(data.businessId),
    businessName: stringValue(data.businessName),
    authorUid: stringValue(data.authorUid),
    authorName: stringValue(data.authorName, "MKE Black member"),
    rating: Math.min(5, Math.max(1, numberValue(data.rating, 5))),
    text: stringValue(data.text),
    photos: photosValue(data.photos),
    relatedListingId: nullableStringValue(data.relatedListingId),
    relatedListingName: nullableStringValue(data.relatedListingName),
    relatedEventId: nullableStringValue(data.relatedEventId),
    relatedEventName: nullableStringValue(data.relatedEventName),
    status: statusValue(data.status),
    createdAt: parseDateValue(data.createdAt),
    updatedAt: parseDateValue(data.updatedAt)
  };
}

/**
 * Returns the deterministic id for a visitor's review of a business —
 * one review per (visitor, business) pair so resubmission edits in place.
 */
export function reviewIdFor(businessId: string, authorUid: string) {
  return `${businessId}_${authorUid}`;
}

/**
 * Uploads review photos to Storage under reviews/{businessId}/{authorUid}/...
 * and returns their public download URLs.
 */
export async function uploadReviewPhotos(
  businessId: string,
  authorUid: string,
  files: File[]
): Promise<string[]> {
  if (!files.length) return [];

  const { storage, storageModule } = await getStorageHelpers();
  const urls: string[] = [];

  for (const file of files) {
    const timestamp = Date.now();
    const storageReference = storageModule.ref(
      storage,
      `reviews/${businessId}/${authorUid}/${timestamp}-${sanitizeFilename(file.name)}`
    );
    const snapshot = await storageModule.uploadBytes(storageReference, file);
    urls.push(await storageModule.getDownloadURL(snapshot.ref));
  }

  return urls;
}

/**
 * Creates or updates a visitor's review of a business. Uses a deterministic
 * id so resubmitting edits the existing review rather than creating a
 * duplicate. Stamps `createdAt` only on first creation.
 */
export async function submitReview(params: {
  businessId: string;
  businessName: string;
  authorUid: string;
  authorName: string;
  rating: number;
  text: string;
  photos?: string[];
  relatedListingId?: string | null;
  relatedListingName?: string | null;
  relatedEventId?: string | null;
  relatedEventName?: string | null;
}): Promise<string> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const id = reviewIdFor(params.businessId, params.authorUid);
  const ref = firestoreModule.doc(db, "reviews", id);
  const existing = await firestoreModule.getDoc(ref);

  const rating = Math.min(5, Math.max(1, Math.round(params.rating)));
  const text = params.text.trim();

  const payload: FirestoreRecord = {
    businessId: params.businessId,
    businessName: params.businessName,
    authorUid: params.authorUid,
    authorName: params.authorName,
    rating,
    text,
    photos: params.photos ?? [],
    relatedListingId: params.relatedListingId ?? null,
    relatedListingName: params.relatedListingName ?? null,
    relatedEventId: params.relatedEventId ?? null,
    relatedEventName: params.relatedEventName ?? null,
    updatedAt: firestoreModule.serverTimestamp()
  };

  if (!existing.exists()) {
    payload.status = "published";
    payload.createdAt = firestoreModule.serverTimestamp();
  }

  await firestoreModule.setDoc(ref, payload, { merge: true });
  return id;
}

/** Fetches a single review by deterministic id, or null if none exists. */
export async function getReview(businessId: string, authorUid: string): Promise<BusinessReview | null> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const id = reviewIdFor(businessId, authorUid);
  const snapshot = await firestoreModule.getDoc(firestoreModule.doc(db, "reviews", id));
  if (!snapshot.exists()) return null;
  return normalizeReview(snapshot.data() as FirestoreRecord, snapshot.id);
}

/** Author or admin removes a review entirely. */
export async function deleteReview(reviewId: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "reviews", reviewId));
}

/** Admin-only moderation — flags or restores a review's visibility. */
export async function setReviewStatus(reviewId: string, status: ReviewStatus) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.setDoc(
    firestoreModule.doc(db, "reviews", reviewId),
    { status },
    { merge: true }
  );
}
