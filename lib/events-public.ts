import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import type {
  DocumentSnapshot,
  QueryDocumentSnapshot
} from "firebase-admin/firestore";

type EventRecord = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  endDate: string | null;
  address: string;
  photoUrl: string;
  ticketUrl: string;
  free: boolean;
  businessId: string;
  businessName: string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isFree(ticketTypes: unknown) {
  if (!Array.isArray(ticketTypes) || ticketTypes.length === 0) {
    return true;
  }

  return ticketTypes.every((ticket) => {
    if (!ticket || typeof ticket !== "object" || Array.isArray(ticket)) {
      return true;
    }

    const price = "priceCents" in ticket ? ticket.priceCents : 0;
    return typeof price !== "number" || price <= 0;
  });
}

function publicEventFromDoc(
  doc: QueryDocumentSnapshot | DocumentSnapshot,
  origin: string
): EventRecord {
  const data = doc.data() ?? {};
  const startsAt = toDate(data.startsAt);
  const endsAt = toDate(data.endsAt);

  return {
    id: doc.id,
    title: text(data.title),
    description: text(data.description),
    date: startsAt?.toISOString() ?? null,
    endDate: endsAt?.toISOString() ?? null,
    address: text(data.address) || text(data.venueName),
    photoUrl: text(data.imageUrl),
    ticketUrl: `${origin.replace(/\/$/, "")}/events`,
    free: isFree(data.ticketTypes),
    businessId: text(data.businessId),
    businessName: text(data.businessName)
  };
}

export async function getPublicEvent(eventId: string, origin: string) {
  const snapshot = await getFirebaseAdminDb().collection("events").doc(eventId).get();
  if (!snapshot.exists || snapshot.data()?.status !== "published") {
    return null;
  }

  return publicEventFromDoc(snapshot, origin);
}

export async function getPublicEventsForBusiness(
  businessId: string,
  origin: string
) {
  const snapshot = await getFirebaseAdminDb()
    .collection("events")
    .where("businessId", "==", businessId)
    .where("status", "==", "published")
    .get();
  const now = Date.now();

  return snapshot.docs
    .map((doc) => publicEventFromDoc(doc, origin))
    .filter((event) => !event.endDate || new Date(event.endDate).getTime() >= now)
    .sort(
      (left, right) =>
        (left.date ? new Date(left.date).getTime() : Number.MAX_SAFE_INTEGER) -
        (right.date ? new Date(right.date).getTime() : Number.MAX_SAFE_INTEGER)
    );
}

export function publicCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export type { EventRecord };
