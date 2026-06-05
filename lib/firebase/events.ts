import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import {
  BusinessEvent,
  BusinessEventFormValues,
  BusinessEventStatus,
  EventTicketType
} from "@/lib/types";

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
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    isRecord(value) &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed
      : null;
  }
  return null;
}

function normalizeStatus(value: unknown): BusinessEventStatus {
  return value === "draft" || value === "cancelled" ? value : "published";
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

export function normalizeTicketTypes(value: unknown): EventTicketType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      const name = stringValue(record.name).trim();
      return {
        id: stringValue(record.id).trim() || `ticket-${index + 1}`,
        name: name || "General admission",
        description: stringValue(record.description).trim(),
        priceCents: Math.max(0, Math.round(numberValue(record.priceCents, 0))),
        quantityTotal: Math.max(0, Math.round(numberValue(record.quantityTotal, 0))),
        quantitySold: Math.max(0, Math.round(numberValue(record.quantitySold, 0))),
        active: booleanValue(record.active, true)
      };
    })
    .filter((ticket) => ticket.name);
}

export function normalizeBusinessEvent(
  value: unknown,
  id: string
): BusinessEvent {
  const record = isRecord(value) ? value : {};
  return {
    id,
    businessId: stringValue(record.businessId).trim(),
    businessName: stringValue(record.businessName).trim(),
    businessSolidarity: booleanValue(record.businessSolidarity, false),
    title: stringValue(record.title).trim(),
    description: stringValue(record.description).trim().slice(0, 1400),
    imageUrl: stringValue(record.imageUrl).trim(),
    venueName: stringValue(record.venueName).trim(),
    address: stringValue(record.address).trim(),
    startsAt: parseDateValue(record.startsAt),
    endsAt: parseDateValue(record.endsAt),
    status: normalizeStatus(record.status),
    ticketTypes: normalizeTicketTypes(record.ticketTypes),
    createdAt: parseDateValue(record.createdAt),
    updatedAt: parseDateValue(record.updatedAt)
  };
}

function normalizeFormTickets(ticketTypes: EventTicketType[]) {
  return ticketTypes
    .filter((ticket) => ticket.name.trim())
    .map((ticket, index) => ({
      id: ticket.id || `ticket-${Date.now()}-${index}`,
      name: ticket.name.trim(),
      description: ticket.description.trim(),
      priceCents: Math.max(0, Math.round(Number(ticket.priceCents) || 0)),
      quantityTotal: Math.max(0, Math.round(Number(ticket.quantityTotal) || 0)),
      quantitySold: Math.max(0, Math.round(Number(ticket.quantitySold) || 0)),
      active: Boolean(ticket.active)
    }));
}

export async function saveBusinessEvent(
  businessId: string,
  businessName: string,
  businessSolidarity: boolean,
  eventId: string | null,
  values: BusinessEventFormValues
): Promise<string> {
  if (!businessSolidarity) {
    throw new Error("Events are only available to Solidarity Circle businesses.");
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const ref = eventId
    ? firestoreModule.doc(db, "events", eventId)
    : firestoreModule.doc(firestoreModule.collection(db, "events"));
  const now = firestoreModule.serverTimestamp();
  const existing = eventId ? await firestoreModule.getDoc(ref) : null;

  const payload = {
    id: ref.id,
    businessId,
    businessName,
    businessSolidarity,
    title: values.title.trim(),
    description: values.description.trim().slice(0, 1400),
    imageUrl: values.imageUrl.trim(),
    venueName: values.venueName.trim(),
    address: values.address.trim(),
    startsAt: values.startsAt ? new Date(values.startsAt) : null,
    endsAt: values.endsAt ? new Date(values.endsAt) : null,
    status: values.status,
    ticketTypes: normalizeFormTickets(values.ticketTypes),
    updatedAt: now
  };

  if (existing?.exists()) {
    await firestoreModule.updateDoc(ref, payload);
  } else {
    await firestoreModule.setDoc(ref, {
      ...payload,
      createdAt: now
    });
  }

  return ref.id;
}

export async function deleteBusinessEvent(eventId: string, imageUrl: string) {
  const [{ db, firestoreModule }, storage] = await Promise.all([
    getFirestoreHelpers(),
    getFirebaseStorage()
  ]);

  if (storage && imageUrl) {
    try {
      const { storageModule } = await getStorageHelpers();
      await storageModule.deleteObject(storageModule.ref(storage, imageUrl));
    } catch {
      // Best-effort cleanup; Firestore deletion should still happen.
    }
  }

  await firestoreModule.deleteDoc(firestoreModule.doc(db, "events", eventId));
}

export async function uploadEventImage(
  businessId: string,
  file: File
): Promise<string> {
  const { storage, storageModule } = await getStorageHelpers();
  const timestamp = Date.now();
  const storageRef = storageModule.ref(
    storage,
    `businesses/${businessId}/events/${timestamp}-${sanitizeFilename(file.name)}`
  );
  const snapshot = await storageModule.uploadBytes(storageRef, file);
  return storageModule.getDownloadURL(snapshot.ref);
}
