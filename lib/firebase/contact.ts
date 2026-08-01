import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { createBusiness } from "@/lib/firebase/businesses";
import { findPossibleDuplicates, normalizeBusinessRecord } from "@/lib/businesses";
import { BUSINESS_CATEGORIES, createEmptyBusinessForm } from "@/lib/constants";
import { BusinessFormValues } from "@/lib/types";
import { addCapability } from "@/lib/user-capabilities";
import { normalizeUrl } from "@/lib/utils";

export type ContactReason =
  | "general"
  | "submit_business"
  | "suggest_business"
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

export type BusinessSubmissionStatus =
  | "pending"
  | "waiting_clarification"
  | "approved"
  | "rejected";

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
      status === "approved" ||
      status === "rejected" ||
      status === "waiting_clarification"
        ? status
        : "pending",
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

  if (data.reason === "submit_business") {
    await fetch("/api/notifications/admin-directory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "submission", id: submissionReference.id })
    }).catch(() => undefined);
  }

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
    .filter(
      (submission) =>
        submission.status === "pending" ||
        submission.status === "waiting_clarification"
    )
    .sort(
      (left, right) =>
        (right.submittedAt?.getTime() ?? 0) -
        (left.submittedAt?.getTime() ?? 0)
    );
}

export async function approveBusinessListingSubmission(
  submission: BusinessListingSubmission,
  options: { duplicateReviewed?: boolean } = {}
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

  const businessesSnapshot = await firestoreModule.getDocs(
    firestoreModule.collection(db, "businesses")
  );
  const duplicateCandidates = findPossibleDuplicates(
    businessesSnapshot.docs.map((document) =>
      normalizeBusinessRecord(document.data(), document.id)
    ),
    submission.businessName ?? "",
    submission.address ?? ""
  );

  if (duplicateCandidates.length && !options.duplicateReviewed) {
    throw new Error(
      `Review the possible duplicate ${duplicateCandidates[0].name} before creating a new listing.`
    );
  }

  const businessId = await createBusiness(businessSubmissionToFormValues(submission));
  const submissionReference = firestoreModule.doc(
    db,
    "contactSubmissions",
    submission.id
  );
  const businessReference = firestoreModule.doc(db, "businesses", businessId);

  await firestoreModule.setDoc(
    businessReference,
    {
      moderationStatus: "approved",
      analyticsSummary: {
        totalProfileViews: 0,
        totalLinkClicks: 0,
        lastActivityAt: null
      }
    },
    { merge: true }
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

export async function resolveSubmissionWithExistingBusiness(
  submission: BusinessListingSubmission,
  businessId: string
) {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) throw new Error("Firebase could not initialize.");

  const businessReference = firestoreModule.doc(db, "businesses", businessId);
  const businessSnapshot = await firestoreModule.getDoc(businessReference);
  if (!businessSnapshot.exists()) throw new Error("The existing listing was not found.");

  const writes: Promise<unknown>[] = [
    firestoreModule.setDoc(
      firestoreModule.doc(db, "contactSubmissions", submission.id),
      {
        status: "approved",
        resolutionType: "linked_existing",
        approvedBusinessId: businessId,
        approvedAt: firestoreModule.serverTimestamp()
      },
      { merge: true }
    )
  ];

  if (submission.submitterUid) {
    const userReference = firestoreModule.doc(db, "users", submission.submitterUid);
    const userSnapshot = await firestoreModule.getDoc(userReference);
    const existingRole = userSnapshot.exists() ? userSnapshot.data().role : null;
    const existingCapabilities = userSnapshot.exists()
      ? userSnapshot.data().capabilities
      : [];

    writes.push(
      firestoreModule.setDoc(
        userReference,
        {
          uid: submission.submitterUid,
          email: submission.ownerEmail || submission.businessEmail || "",
          role: existingRole === "admin" ? "admin" : "business",
          capabilities: addCapability(existingCapabilities, "business"),
          businessId
        },
        { merge: true }
      )
    );

    if (!String(businessSnapshot.data()?.ownerUid ?? "").trim()) {
      writes.push(
        firestoreModule.setDoc(
          businessReference,
          { ownerUid: submission.submitterUid, claimInviteStatus: "claimed" },
          { merge: true }
        )
      );
    }
  }

  await Promise.all(writes);
}

export async function requestBusinessSubmissionClarification(
  submission: BusinessListingSubmission,
  message: string
) {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) throw new Error("Add a question for the submitter.");

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firebase could not initialize.");

  const recipient = (submission.ownerEmail || submission.businessEmail || "").trim();
  if (!recipient) throw new Error("This submission does not include an email address.");

  await Promise.all([
    firestoreModule.setDoc(
      firestoreModule.doc(db, "contactSubmissions", submission.id),
      {
        status: "waiting_clarification",
        clarificationMessage: normalizedMessage,
        clarificationRequestedAt: firestoreModule.serverTimestamp()
      },
      { merge: true }
    ),
    firestoreModule.setDoc(
      firestoreModule.doc(firestoreModule.collection(db, "mail")),
      {
        to: [recipient],
        message: {
          subject: `A question about ${submission.businessName || "your MKE Black listing"}`,
          text: `${normalizedMessage}\n\nReply to this email or contact MKE Black to continue your directory request.`,
          html: `<p>${normalizedMessage.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character)}</p><p>Reply to this email or contact MKE Black to continue your directory request.</p>`
        },
        createdAt: firestoreModule.serverTimestamp(),
        submissionId: submission.id
      }
    )
  ]);
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
