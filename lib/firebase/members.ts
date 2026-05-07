import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { SolidarityMember, SolidarityMemberStatus } from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

function isRecord(v: unknown): v is FirestoreRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (isRecord(value) && "toDate" in value && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  return null;
}

function normalizeStatus(v: unknown): SolidarityMemberStatus {
  if (v === "active" || v === "expired" || v === "comp") return v;
  return "pending";
}

function normalizePaymentSource(
  v: unknown
): SolidarityMember["paymentSource"] {
  if (v === "givebutter" || v === "stripe" || v === "comp" || v === "manual")
    return v;
  return "givebutter";
}

export function normalizeSolidarityMember(
  data: unknown,
  id: string
): SolidarityMember {
  const r = isRecord(data) ? data : {};
  return {
    id,
    email: str(r.email).trim(),
    name: str(r.name).trim(),
    uid: str(r.uid).trim() || null,
    businessId: str(r.businessId).trim() || null,
    status: normalizeStatus(r.status),
    joinedAt: parseDateValue(r.joinedAt),
    expiresAt: parseDateValue(r.expiresAt),
    notes: str(r.notes),
    paymentSource: normalizePaymentSource(r.paymentSource),
    paymentReference: str(r.paymentReference).trim()
  };
}

async function getHelpers() {
  if (!isFirebaseConfigured) throw new Error("Firebase not configured.");
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firebase could not initialize.");
  return { firestoreModule, db };
}

export async function submitMembershipInterest(data: {
  name: string;
  email: string;
  paymentReference?: string;
}): Promise<string> {
  const { firestoreModule, db } = await getHelpers();
  const ref = firestoreModule.doc(firestoreModule.collection(db, "members"));
  await firestoreModule.setDoc(ref, {
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    paymentReference: data.paymentReference?.trim() ?? "",
    paymentSource: "givebutter",
    status: "pending",
    uid: null,
    businessId: null,
    notes: "",
    joinedAt: firestoreModule.serverTimestamp(),
    expiresAt: null
  });
  return ref.id;
}

export async function updateMemberStatus(
  memberId: string,
  status: SolidarityMemberStatus
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "members", memberId),
    { status }
  );
}

export async function updateMemberExpiry(
  memberId: string,
  expiresAt: Date | null
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "members", memberId),
    { expiresAt: expiresAt ?? null }
  );
}

export async function updateMemberNotes(
  memberId: string,
  notes: string
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "members", memberId),
    { notes }
  );
}

export async function linkMemberToUser(
  memberId: string,
  uid: string | null
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "members", memberId),
    { uid: uid ?? null }
  );
}

export async function linkMemberToBusiness(
  memberId: string,
  businessId: string | null
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "members", memberId),
    { businessId: businessId ?? null }
  );
}
