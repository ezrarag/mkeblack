import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";

export type BusinessReportReason =
  | "Business has closed"
  | "Wrong hours"
  | "Wrong address/phone"
  | "Other";

export type BusinessReport = {
  id: string;
  businessId: string;
  businessName: string;
  reason: BusinessReportReason;
  comment: string;
  reporterEmail: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: Date | null;
  resolvedAt: Date | null;
};

function parseDateValue(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }

  return null;
}

export function normalizeBusinessReport(
  data: Record<string, unknown>,
  id: string
): BusinessReport {
  return {
    id,
    businessId: String(data.businessId ?? ""),
    businessName: String(data.businessName ?? ""),
    reason: String(data.reason ?? "Other") as BusinessReportReason,
    comment: String(data.comment ?? ""),
    reporterEmail: String(data.reporterEmail ?? ""),
    status:
      data.status === "resolved" || data.status === "dismissed"
        ? data.status
        : "open",
    createdAt: parseDateValue(data.createdAt),
    resolvedAt: parseDateValue(data.resolvedAt)
  };
}

export async function submitBusinessReport(data: {
  businessId: string;
  businessName: string;
  reason: BusinessReportReason;
  comment: string;
  reporterEmail: string;
}) {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firestore is not available.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(firestoreModule.collection(db, "business_reports")),
    {
      businessId: data.businessId,
      businessName: data.businessName,
      reason: data.reason,
      comment: data.comment.trim(),
      reporterEmail: data.reporterEmail.trim(),
      status: "open",
      createdAt: firestoreModule.serverTimestamp()
    }
  );
}
