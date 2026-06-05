import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { createBusiness } from "@/lib/firebase/businesses";
import { BUSINESS_CATEGORIES, createEmptyBusinessForm } from "@/lib/constants";
import { BusinessFormValues } from "@/lib/types";
import { addCapability } from "@/lib/user-capabilities";
import { normalizeUrl } from "@/lib/utils";

export type ContactReason =
  | "general"
  | "submit_business"
  | "partnership"
  | "correction"
  | "other";

export type ContactFormData = {
  reason: ContactReason;
  ownerName: string;
  ownerEmail: string;
  message: string;
  businessName?: string;
  businessOwner?: string;
  businessEmail?: string;
  phone?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  description?: string;
  submitterUid?: string | null;
  submitterDisplayName?: string | null;
  submitterPhotoUrl?: string | null;
};

export type BusinessSubmissionStatus = "pending" | "approved" | "rejected";

export type BusinessListingSubmission = ContactFormData & {
  id: string;
  status: BusinessSubmissionStatus;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedBusinessId: string | null;
  solidarityCheckoutStarted: boolean;
  solidarityPaymentStatus: string;
  solidarityMemberId: string | null;
  solidarityMembershipPlan: string;
};

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (
    isRecord(value) &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsedDate = value.toDate();
    return parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())
      ? parsedDate
      : null;
  }

  return null;
}

function normalizeBusinessSubmission(
  id: string,
  value: unknown
): BusinessListingSubmission {
  const record = isRecord(value) ? value : {};
  const status = stringValue(record.status);

  return {
    id,
    reason: "submit_business",
    ownerName: stringValue(record.ownerName),
    ownerEmail: stringValue(record.ownerEmail),
    message: stringValue(record.message),
    businessName: stringValue(record.businessName),
    businessOwner: stringValue(record.businessOwner),
    businessEmail: stringValue(record.businessEmail),
    phone: stringValue(record.phone),
    address: stringValue(record.address),
    website: stringValue(record.website),
    logoUrl: stringValue(record.logoUrl),
    description: stringValue(record.description),
    submitterUid: stringValue(record.submitterUid) || null,
    submitterDisplayName: stringValue(record.submitterDisplayName) || null,
    submitterPhotoUrl: stringValue(record.submitterPhotoUrl) || null,
    status:
      status === "approved" || status === "rejected" ? status : "pending",
    submittedAt: parseDateValue(record.submittedAt),
    approvedAt: parseDateValue(record.approvedAt),
    approvedBusinessId: stringValue(record.approvedBusinessId) || null,
    solidarityCheckoutStarted: record.solidarityCheckoutStarted === true,
    solidarityPaymentStatus: stringValue(record.solidarityPaymentStatus),
    solidarityMemberId: stringValue(record.solidarityMemberId) || null,
    solidarityMembershipPlan: stringValue(record.solidarityMembershipPlan)
  };
}

function businessSubmissionToFormValues(
  submission: BusinessListingSubmission
): BusinessFormValues {
  const category =
    BUSINESS_CATEGORIES.find((candidate) => candidate === "Other") ??
    BUSINESS_CATEGORIES[0];
  const logoUrl = normalizeUrl((submission.logoUrl ?? "").trim());

  return {
    ...createEmptyBusinessForm(),
    name: (submission.businessName ?? "").trim(),
    category,
    description: (submission.description ?? "").trim(),
    address: (submission.address ?? "").trim(),
    phone: (submission.phone ?? "").trim(),
    website: normalizeUrl((submission.website ?? "").trim()),
    email: (submission.businessEmail || submission.ownerEmail).trim(),
    photos: logoUrl ? [logoUrl] : [],
    ownerUid: submission.submitterUid ?? "",
    active: true,
    source: "self-submitted"
  };
}

export async function submitContactForm(data: ContactFormData): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  const submissionReference = await firestoreModule.addDoc(
    firestoreModule.collection(db, "contactSubmissions"),
    {
      ...data,
      status: data.reason === "submit_business" ? "pending" : null,
      submittedAt: firestoreModule.serverTimestamp()
    }
  );

  return submissionReference.id;
}

export async function attachGoogleAccountToBusinessSubmission(
  submissionId: string,
  data: {
    submitterUid: string;
    submitterDisplayName: string | null;
    submitterPhotoUrl: string | null;
    ownerName: string;
    ownerEmail: string;
  }
): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "contactSubmissions", submissionId),
    data,
    { merge: true }
  );
}

export async function getPendingBusinessListingSubmissions(): Promise<
  BusinessListingSubmission[]
> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "contactSubmissions"),
      firestoreModule.where("reason", "==", "submit_business")
    )
  );

  return snapshot.docs
    .map((docSnapshot) =>
      normalizeBusinessSubmission(docSnapshot.id, docSnapshot.data())
    )
    .filter((submission) => submission.status === "pending")
    .sort(
      (left, right) =>
        (right.submittedAt?.getTime() ?? 0) -
        (left.submittedAt?.getTime() ?? 0)
    );
}

export async function approveBusinessListingSubmission(
  submission: BusinessListingSubmission
) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  if (!submission.businessName?.trim()) {
    throw new Error("Business name is required before approval.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  const businessId = await createBusiness(businessSubmissionToFormValues(submission));
  const submissionReference = firestoreModule.doc(
    db,
    "contactSubmissions",
    submission.id
  );

  await firestoreModule.setDoc(
    submissionReference,
    {
      status: "approved",
      approvedBusinessId: businessId,
      approvedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );

  if (submission.submitterUid) {
    const userReference = firestoreModule.doc(db, "users", submission.submitterUid);
    const userSnapshot = await firestoreModule.getDoc(userReference);
    const existingRole = userSnapshot.exists() ? userSnapshot.data().role : null;
    const existingCapabilities = userSnapshot.exists()
      ? userSnapshot.data().capabilities
      : [];

    await firestoreModule.setDoc(
      userReference,
      {
        uid: submission.submitterUid,
        email: submission.ownerEmail || submission.businessEmail || "",
        role: existingRole === "admin" ? "admin" : "business",
        capabilities: addCapability(existingCapabilities, "business"),
        businessId
      },
      { merge: true }
    );
  }

  return businessId;
}

export async function rejectBusinessListingSubmission(submissionId: string) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "contactSubmissions", submissionId),
    {
      status: "rejected",
      rejectedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

export async function submitNewsletterSignup(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "newsletter_subscribers", normalizedEmail),
    {
      email: normalizedEmail,
      source: "site_footer",
      subscribedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}
