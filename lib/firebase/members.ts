import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { BenefitType, SolidarityMember, SolidarityMemberStatus } from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

function isRecord(v: unknown): v is FirestoreRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function stringListValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
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
  if (
    v === "active" ||
    v === "expired" ||
    v === "comp" ||
    v === "rejected" ||
    v === "trash"
  ) {
    return v;
  }
  return "pending";
}

function normalizePaymentSource(
  v: unknown
): SolidarityMember["paymentSource"] {
  if (v === "stripe" || v === "comp" || v === "manual")
    return v;
  return "manual";
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
    benefitIds: stringListValue(r.benefitIds),
    paymentSource: normalizePaymentSource(r.paymentSource),
    paymentReference: str(r.paymentReference).trim()
  };
}

export function normalizeBenefitType(data: unknown, id: string): BenefitType {
  const r = isRecord(data) ? data : {};
  return {
    id,
    label: str(r.label).trim(),
    description: str(r.description).trim(),
    active: boolValue(r.active, true),
    order: numberValue(r.order, 0)
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
    paymentSource: "manual",
    status: "pending",
    uid: null,
    businessId: null,
    notes: "",
    benefitIds: [],
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

export async function updateMemberBenefits(
  memberId: string,
  benefitIds: string[]
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.updateDoc(
    firestoreModule.doc(db, "members", memberId),
    { benefitIds: benefitIds.map((id) => id.trim()).filter(Boolean) }
  );
}

export async function saveMemberAdminState(
  memberId: string,
  data: {
    status: SolidarityMemberStatus;
    notes: string;
    uid: string | null;
    businessId: string | null;
    expiresAt: Date | null;
    benefitIds: string[];
  }
): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  const memberRef = firestoreModule.doc(db, "members", memberId);
  const previousSnapshot = await firestoreModule.getDoc(memberRef);
  const previous = previousSnapshot.exists()
    ? normalizeSolidarityMember(previousSnapshot.data(), previousSnapshot.id)
    : null;
  const nextBusinessId = data.businessId?.trim() || null;
  const previousBusinessId = previous?.businessId ?? null;
  const isActiveBusinessMember =
    data.status === "active" || data.status === "comp";
  const previousBusinessSnapshot =
    previousBusinessId && previousBusinessId !== nextBusinessId
      ? await firestoreModule.getDoc(
          firestoreModule.doc(db, "businesses", previousBusinessId)
        )
      : null;
  const nextBusinessSnapshot = nextBusinessId
    ? await firestoreModule.getDoc(
        firestoreModule.doc(db, "businesses", nextBusinessId)
      )
    : null;

  if (nextBusinessId && !nextBusinessSnapshot?.exists()) {
    throw new Error("Linked business ID was not found.");
  }

  const batch = firestoreModule.writeBatch(db);
  batch.update(memberRef, {
    status: data.status,
    notes: data.notes,
    uid: data.uid?.trim() || null,
    businessId: nextBusinessId,
    expiresAt: data.expiresAt ?? null,
    benefitIds: data.benefitIds.map((id) => id.trim()).filter(Boolean)
  });

  if (
    previousBusinessId &&
    previousBusinessId !== nextBusinessId &&
    previousBusinessSnapshot?.exists()
  ) {
    batch.update(firestoreModule.doc(db, "businesses", previousBusinessId), {
      solidarityMember: false,
      solidarityMemberExpiry: null
    });
  }

  if (nextBusinessId) {
    batch.update(firestoreModule.doc(db, "businesses", nextBusinessId), {
      solidarityMember: isActiveBusinessMember,
      solidarityMemberSince: isActiveBusinessMember
        ? previous?.joinedAt ?? firestoreModule.serverTimestamp()
        : null,
      solidarityMemberExpiry: isActiveBusinessMember ? data.expiresAt ?? null : null
    });
  }

  await batch.commit();
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

export async function saveBenefitType(
  benefitId: string | null,
  data: Omit<BenefitType, "id">
): Promise<string> {
  const { firestoreModule, db } = await getHelpers();
  const ref = benefitId
    ? firestoreModule.doc(db, "benefit_types", benefitId)
    : firestoreModule.doc(firestoreModule.collection(db, "benefit_types"));

  await firestoreModule.setDoc(
    ref,
    {
      label: data.label.trim(),
      description: data.description.trim(),
      active: data.active,
      order: Number.isFinite(data.order) ? data.order : 0
    },
    { merge: true }
  );

  return ref.id;
}

export async function deleteBenefitType(benefitId: string): Promise<void> {
  const { firestoreModule, db } = await getHelpers();
  await firestoreModule.deleteDoc(
    firestoreModule.doc(db, "benefit_types", benefitId)
  );
}
