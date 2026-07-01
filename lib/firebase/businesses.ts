import {
  createClosedBusinessHours,
  createEmptyBusinessForm,
  MILWAUKEE_CENTER
} from "@/lib/constants";
import {
  createBusinessDuplicateKey,
  normalizeBusinessRecord
} from "@/lib/businesses";
import { hasNoStructuredHours } from "@/lib/hours-sync";
import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import { geocodeAddress } from "@/lib/geocode";
import { getMilwaukeeNeighborhoods } from "@/lib/firebase/neighborhoods";
import { getNeighborhoodForPoint } from "@/lib/neighborhood";
import { updateBusinessTagUsageCounts } from "@/lib/firebase/tags";
import { updateBusinessCategoryUsageCounts } from "@/lib/firebase/categories";
import {
  Business,
  BusinessClaimInvite,
  BusinessFormValues,
  TeamMemberRoleType
} from "@/lib/types";
import { addCapability, removeCapability } from "@/lib/user-capabilities";
import { normalizeUrl } from "@/lib/utils";
import { normalizeTagSlugs } from "@/lib/tags";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
}

/**
 * Wix exports category as a JSON-array string e.g. '["Food & Drink"]'
 * or '["Music, Entertainment & Culture"]'. Strip all that and return
 * just the first clean value.
 */
function parseWixCategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Try proper JSON parse first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return String(parsed[0]).trim();
    }
  } catch {
    // Not valid JSON — fall through to regex cleanup
  }

  // Strip leading/trailing brackets and quotes manually
  return trimmed
    .replace(/^\["|"\]$/g, "")   // ["..."]  →  ...
    .replace(/^\["?|"?\]$/g, "") // fallback bracket strip
    .replace(/^"+|"+$/g, "")     // strip stray quotes
    .split('","')[0]              // take first if multiple
    ?.trim() ?? trimmed;
}

/**
 * Normalize a phone value from the CSV — Wix stores numbers without
 * formatting, e.g. 4142150052. Format as (414) 215-0052.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.trim(); // Unknown format — keep as-is
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  return {
    db,
    firestoreModule
  };
}

async function getStorageHelpers() {
  const [storageModule, storage] = await Promise.all([
    loadFirebaseStorageModule(),
    getFirebaseStorage()
  ]);

  if (!storage) {
    throw new Error("Firebase Storage is not available in this environment.");
  }

  return {
    storage,
    storageModule
  };
}

export function createBusinessDraft() {
  return createEmptyBusinessForm();
}

function isDefaultMapLocation(location: { lat: number; lng: number }) {
  return (
    Math.abs(location.lat - MILWAUKEE_CENTER.lat) < 0.000001 &&
    Math.abs(location.lng - MILWAUKEE_CENTER.lng) < 0.000001
  );
}

export function normalizeBusinessPayload(values: BusinessFormValues) {
  const email = values.email.trim();
  const location = {
    lat: Number(values.location.lat),
    lng: Number(values.location.lng)
  };
  const locationVerified =
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    !isDefaultMapLocation(location);
  const geocodingStatus = (
    locationVerified ? "manual" : "needs_geocode"
  ) as Business["geocodingStatus"];

  return {
    ...values,
    name: values.name.trim(),
    category: values.category.trim(),
    description: values.description.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
    website: normalizeUrl(values.website.trim()),
    instagramReelUrl: normalizeUrl(values.instagramReelUrl.trim()),
    email,
    emailLower: email.toLowerCase(),
    hoursText: values.hoursText.trim(),
    neighborhood: values.neighborhood.trim(),
    tags: normalizeTagSlugs(values.tags),
    photos: values.photos.filter(Boolean),
    ownerUid: values.ownerUid.trim(),
    active: Boolean(values.active),
    source: values.source,
    yelpBusinessId: values.yelpBusinessId.trim(),
    yelpAlias: values.yelpAlias.trim(),
    location,
    locationVerified,
    geocodingStatus
  };
}

export async function createPendingBusinessClaim({
  businessId,
  businessName,
  claimedByUid,
  claimedByEmail,
  claimedByName,
  requestedRoleType
}: {
  businessId: string;
  businessName: string;
  claimedByUid: string;
  claimedByEmail: string;
  claimedByName: string;
  requestedRoleType: TeamMemberRoleType;
}): Promise<"pending_verification" | "auto_approved"> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const businessReference = firestoreModule.doc(db, "businesses", businessId);
  const businessSnapshot = await firestoreModule.getDoc(businessReference);
  const businessData = businessSnapshot.exists() ? businessSnapshot.data() : null;
  const normalizedClaimEmail = claimedByEmail.trim().toLowerCase();
  const normalizedBusinessEmail = String(
    businessData?.emailLower ?? businessData?.email ?? ""
  ).trim().toLowerCase();
  const currentOwnerUid = String(businessData?.ownerUid ?? "").trim();
  const autoApprove =
    requestedRoleType === "owner" &&
    !currentOwnerUid &&
    normalizedClaimEmail.length > 0 &&
    normalizedClaimEmail === normalizedBusinessEmail;
  const claimReference = firestoreModule.doc(
    firestoreModule.collection(db, "pending_claims")
  );

  if (autoApprove) {
    const userReference = firestoreModule.doc(db, "users", claimedByUid);
    const userSnapshot = await firestoreModule.getDoc(userReference);
    const existingRole = userSnapshot.exists() ? userSnapshot.data().role : null;
    const existingCapabilities = userSnapshot.exists()
      ? userSnapshot.data().capabilities
      : [];
    const batch = firestoreModule.writeBatch(db);

    batch.set(
      businessReference,
      {
        ownerUid: claimedByUid,
        claimInviteStatus: "claimed"
      },
      { merge: true }
    );
    batch.set(
      userReference,
      {
        uid: claimedByUid,
        email: claimedByEmail.trim(),
        emailLower: claimedByEmail.trim().toLowerCase(),
        role: existingRole === "admin" ? "admin" : "business",
        capabilities: addCapability(existingCapabilities, "business"),
        businessId
      },
      { merge: true }
    );
    batch.set(claimReference, {
      businessId,
      businessName,
      claimedByUid,
      claimedByEmail,
      claimedByName,
      requestedRoleType,
      status: "auto_approved",
      claimedAt: firestoreModule.serverTimestamp(),
      resolvedAt: firestoreModule.serverTimestamp(),
      autoApprovedReason: "email_match"
    });

    await batch.commit();
    return "auto_approved";
  }

  await firestoreModule.setDoc(
    claimReference,
    {
      businessId,
      businessName,
      claimedByUid,
      claimedByEmail,
      claimedByName,
      requestedRoleType,
      status: "pending_verification",
      claimedAt: firestoreModule.serverTimestamp()
    }
  );

  return "pending_verification";
}

async function syncOwnerBusinessLink(ownerUid: string | null, businessId: string) {
  if (!ownerUid) {
    return;
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const userReference = firestoreModule.doc(db, "users", ownerUid);
  const userSnapshot = await firestoreModule.getDoc(userReference);

  if (!userSnapshot.exists()) {
    return;
  }

  await firestoreModule.setDoc(
    userReference,
    {
      uid: ownerUid,
      businessId,
      role: userSnapshot.data().role === "admin" ? "admin" : "business",
      capabilities: addCapability(userSnapshot.data().capabilities, "business")
    },
    { merge: true }
  );
}

async function unlinkOwnerBusinessLink(ownerUid: string | null, businessId: string) {
  if (!ownerUid) {
    return;
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const userReference = firestoreModule.doc(db, "users", ownerUid);
  const userSnapshot = await firestoreModule.getDoc(userReference);

  if (!userSnapshot.exists()) {
    return;
  }

  const userData = userSnapshot.data();

  if (userData.businessId && userData.businessId !== businessId) {
    return;
  }

  const nextCapabilities = removeCapability(userData.capabilities, "business");
  const hasAdminAccess =
    userData.role === "admin" || nextCapabilities.includes("admin");

  await firestoreModule.setDoc(
    userReference,
    {
      businessId: null,
      capabilities: nextCapabilities,
      role: hasAdminAccess ? "admin" : "visitor"
    },
    { merge: true }
  );
}

export async function saveBusiness(
  businessId: string,
  values: BusinessFormValues,
  previousAddress?: string
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const businessReference = firestoreModule.doc(db, "businesses", businessId);
  const previousSnapshot = await firestoreModule.getDoc(businessReference);
  const previousOwnerUid = previousSnapshot.exists()
    ? String(previousSnapshot.data().ownerUid ?? "").trim() || null
    : null;
  const previousTags = previousSnapshot.exists()
    ? normalizeTagSlugs(previousSnapshot.data().tags)
    : [];
  const previousCategory = previousSnapshot.exists()
    ? previousSnapshot.data().category
    : null;
  const payload = normalizeBusinessPayload(values);

  if (!payload.address) {
    payload.location = values.location;
    payload.locationVerified =
      Number.isFinite(payload.location.lat) &&
      Number.isFinite(payload.location.lng) &&
      !isDefaultMapLocation(payload.location);
    payload.geocodingStatus = payload.locationVerified ? "manual" : "needs_geocode";
  } else if (
    payload.address !== previousAddress ||
    !Number.isFinite(payload.location.lat) ||
    !Number.isFinite(payload.location.lng)
  ) {
    const geocodedLocation = await geocodeAddress(payload.address);

    if (geocodedLocation) {
      payload.location = geocodedLocation;
      payload.locationVerified = true;
      payload.geocodingStatus = "verified";
    } else {
      payload.locationVerified = false;
      payload.geocodingStatus = "failed";
    }
  }

  const neighborhoods = await getMilwaukeeNeighborhoods();
  if (payload.locationVerified) {
    payload.neighborhood =
      getNeighborhoodForPoint(
        payload.location.lat,
        payload.location.lng,
        neighborhoods
      ) ?? payload.neighborhood;
  }

  await firestoreModule.setDoc(
    businessReference,
    {
      id: businessId,
      ...payload,
      ownerUid: payload.ownerUid || null,
      hoursSource: hasNoStructuredHours(payload.hours) ? null : "manual",
      hoursSkipped: false,
      hoursLastSynced: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );

  await updateBusinessTagUsageCounts(previousTags, payload.tags);
  await updateBusinessCategoryUsageCounts(previousCategory, payload.category);

  if (previousOwnerUid && previousOwnerUid !== (payload.ownerUid || null)) {
    await unlinkOwnerBusinessLink(previousOwnerUid, businessId);
  }

  await syncOwnerBusinessLink(payload.ownerUid || null, businessId);
}

export async function unlinkBusinessOwner(businessId: string, ownerUid: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();

  await Promise.all([
    firestoreModule.setDoc(
      firestoreModule.doc(db, "businesses", businessId),
      {
        ownerUid: null,
        claimInviteStatus: "not_invited"
      },
      { merge: true }
    ),
    unlinkOwnerBusinessLink(ownerUid, businessId)
  ]);
}

export async function createBusiness(values: BusinessFormValues) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const businessReference = firestoreModule.doc(
    firestoreModule.collection(db, "businesses")
  );

  await saveBusiness(businessReference.id, values);
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
  return businessReference.id;
}

export async function deleteBusiness(business: Pick<Business, "id" | "photos">) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const storage = await getFirebaseStorage();
  const businessReference = firestoreModule.doc(db, "businesses", business.id);
  const businessSnapshot = await firestoreModule.getDoc(businessReference);
  const previousTags = businessSnapshot.exists()
    ? normalizeTagSlugs(businessSnapshot.data().tags)
    : [];

  if (storage) {
    const { storageModule } = await getStorageHelpers();

    for (const photoUrl of business.photos) {
      try {
        await storageModule.deleteObject(storageModule.ref(storage, photoUrl));
      } catch {
        // Ignore storage cleanup failures so Firestore deletion can continue.
      }
    }
  }

  await firestoreModule.deleteDoc(businessReference);
  await updateBusinessTagUsageCounts(previousTags, []);
}

export async function uploadBusinessPhotos(businessId: string, files: File[]) {
  if (!files.length) {
    return [];
  }

  const [{ db, firestoreModule }, { storage, storageModule }] = await Promise.all([
    getFirestoreHelpers(),
    getStorageHelpers()
  ]);

  const photoUrls: string[] = [];

  for (const file of files) {
    const timestamp = Date.now();
    const storageReference = storageModule.ref(
      storage,
      `businesses/${businessId}/${timestamp}-${sanitizeFilename(file.name)}`
    );

    const snapshot = await storageModule.uploadBytes(storageReference, file);
    photoUrls.push(await storageModule.getDownloadURL(snapshot.ref));
  }

  await firestoreModule.updateDoc(firestoreModule.doc(db, "businesses", businessId), {
    photos: firestoreModule.arrayUnion(...photoUrls)
  });

  return photoUrls;
}

export async function removeBusinessPhoto(businessId: string, photoUrl: string) {
  const [{ db, firestoreModule }, { storage, storageModule }] = await Promise.all([
    getFirestoreHelpers(),
    getStorageHelpers()
  ]);

  try {
    await storageModule.deleteObject(storageModule.ref(storage, photoUrl));
  } catch {
    // Ignore storage cleanup failures so Firestore state can still be updated.
  }

  await firestoreModule.updateDoc(firestoreModule.doc(db, "businesses", businessId), {
    photos: firestoreModule.arrayRemove(photoUrl)
  });
}

export async function setBusinessesActive(
  businessIds: string[],
  active: boolean
) {
  const { db, firestoreModule } = await getFirestoreHelpers();

  for (const businessId of businessIds) {
    await firestoreModule.setDoc(
      firestoreModule.doc(db, "businesses", businessId),
      { active },
      { merge: true }
    );
  }
}

export async function revertBusinessToPending(businessId: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const businessReference = firestoreModule.doc(db, "businesses", businessId);

  await firestoreModule.setDoc(
    businessReference,
    {
      active: false,
      moderationStatus: "pending"
    },
    { merge: true }
  );

  const submissionsSnapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "contactSubmissions"),
      firestoreModule.where("approvedBusinessId", "==", businessId)
    )
  );

  for (const submissionDocument of submissionsSnapshot.docs) {
    await firestoreModule.setDoc(
      submissionDocument.ref,
      {
        status: "pending",
        approvedAt: null,
        approvedBusinessId: null,
        rejectedAt: null
      },
      { merge: true }
    );
  }
}

export async function deleteBusinesses(
  businesses: Array<Pick<Business, "id" | "photos">>
) {
  for (const business of businesses) {
    await deleteBusiness(business);
  }
}

type ImportBusinessRow = {
  name: string;
  category: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  hoursText?: string;
};

type ImportBusinessesOptions = {
  onProgress?: (completed: number, total: number) => void;
};

export async function importBusinesses(
  rows: ImportBusinessRow[],
  options: ImportBusinessesOptions = {}
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const neighborhoods = await getMilwaukeeNeighborhoods();
  const existingSnapshot = await firestoreModule.getDocs(
    firestoreModule.collection(db, "businesses")
  );
  const seenKeys = new Set(
    existingSnapshot.docs.map((document) => {
      const business = normalizeBusinessRecord(document.data(), document.id);
      return createBusinessDuplicateKey(business.name, business.address);
    })
  );

  let imported = 0;
  let duplicates = 0;
  let failed = 0;
  let completed = 0;

  for (const row of rows) {
    const name = row.name.trim();

    // Clean Wix JSON-array category format: ["Food & Drink"] → Food & Drink
    const category = parseWixCategory(row.category ?? "");

    const address = row.address?.trim() ?? "";
    const duplicateKey = createBusinessDuplicateKey(name, address);

    if (!name || !category) {
      failed += 1;
      completed += 1;
      options.onProgress?.(completed, rows.length);
      continue;
    }

    if (seenKeys.has(duplicateKey)) {
      duplicates += 1;
      completed += 1;
      options.onProgress?.(completed, rows.length);
      continue;
    }

    const location = address ? await geocodeAddress(address) : null;
    const neighborhood = location
      ? getNeighborhoodForPoint(location.lat, location.lng, neighborhoods) ?? ""
      : "";
    const tags = ["black-owned"];
    const businessReference = firestoreModule.doc(
      firestoreModule.collection(db, "businesses")
    );

    // Normalize phone from Wix numeric format e.g. 4142150052 → (414) 215-0052
    const phone = normalizePhone(row.phone?.trim() ?? "");

    const email = row.email?.trim() ?? "";

    await firestoreModule.setDoc(firestoreModule.doc(db, "businesses", businessReference.id), {
      id: businessReference.id,
      name,
      category,
      description: "",
      address,
      phone,
      website: normalizeUrl(row.website?.trim() ?? ""),
      instagramReelUrl: "",
      email,
      emailLower: email.toLowerCase(),
      hoursText: row.hoursText?.trim() ?? "",
      neighborhood,
      tags,
      hours: createClosedBusinessHours(),
      hoursSource: row.hoursText?.trim() ? "imported_text" : null,
      hoursSkipped: false,
      hoursLastSynced: null,
      photos: [],
      ownerUid: null,
      active: true,
      analyticsSummary: {
        totalProfileViews: 0,
        totalLinkClicks: 0,
        lastActivityAt: null
      },
      moderationStatus: "approved",
      hasTeamProfiles: false,
      source: "import",
      importedAt: firestoreModule.serverTimestamp(),
      claimInviteStatus: "not_invited",
      claimInvitedAt: null,
      location: location ?? createEmptyBusinessForm().location,
      locationVerified: Boolean(location),
      geocodingStatus: location ? "verified" : address ? "failed" : "needs_geocode"
    });

    await updateBusinessTagUsageCounts([], tags);
    seenKeys.add(duplicateKey);
    imported += 1;
    completed += 1;
    options.onProgress?.(completed, rows.length);
  }

  return {
    imported,
    duplicates,
    failed
  };
}

export async function sendBusinessClaimInvite(
  business: Pick<Business, "id" | "name" | "email">,
  appOrigin: string
) {
  const { db, firestoreModule } = await getFirestoreHelpers();

  if (!business.email.trim()) {
    throw new Error("Add an email address to this listing before sending an invite.");
  }

  const inviteUrl = `${appOrigin.replace(/\/$/, "")}/claim/${business.id}`;

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "business_claim_invites", business.id),
    {
      id: business.id,
      businessId: business.id,
      businessName: business.name,
      email: business.email.trim(),
      status: "pending",
      createdAt: firestoreModule.serverTimestamp(),
      claimedAt: null,
      claimedByUid: null
    },
    { merge: true }
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(firestoreModule.collection(db, "mail")),
    {
      to: [business.email.trim()],
      message: {
        subject: `Claim your MKE Black listing for ${business.name}`,
        text: `A listing for ${business.name} is ready to be claimed on MKE Black. Create your account here: ${inviteUrl}`,
        html: `<p>A listing for <strong>${business.name}</strong> is ready to be claimed on MKE Black.</p><p><a href="${inviteUrl}">Create your account and claim this listing</a></p>`
      }
    }
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "businesses", business.id),
    {
      claimInviteStatus: "pending",
      claimInvitedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

export async function claimBusinessListing(
  invite: Pick<BusinessClaimInvite, "businessId" | "email">,
  uid: string
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const userReference = firestoreModule.doc(db, "users", uid);
  const userSnapshot = await firestoreModule.getDoc(userReference);
  const existingRole = userSnapshot.exists() ? userSnapshot.data().role : null;
  const existingCapabilities = userSnapshot.exists()
    ? userSnapshot.data().capabilities
    : [];

  await firestoreModule.setDoc(
    userReference,
    {
      uid,
      email: invite.email.trim(),
      emailLower: invite.email.trim().toLowerCase(),
      role: existingRole === "admin" ? "admin" : "business",
      capabilities: addCapability(existingCapabilities, "business"),
      businessId: invite.businessId
    },
    { merge: true }
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "businesses", invite.businessId),
    {
      ownerUid: uid,
      email: invite.email.trim(),
      claimInviteStatus: "claimed"
    },
    { merge: true }
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "business_claim_invites", invite.businessId),
    {
      status: "claimed",
      claimedAt: firestoreModule.serverTimestamp(),
      claimedByUid: uid
    },
    { merge: true }
  );
}

export async function setBusinessSolidarityMembership(
  businessId: string,
  data: {
    solidarityMember: boolean;
    solidarityMemberSince: Date | null;
    solidarityMemberExpiry: Date | null;
    solidarityMembershipSource: "stripe" | "manual" | "comp";
    solidarityMembershipNotes: string;
  }
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.updateDoc(firestoreModule.doc(db, "businesses", businessId), {
    solidarityMember: data.solidarityMember,
    solidarityMemberSince: data.solidarityMemberSince ?? null,
    solidarityMemberExpiry: data.solidarityMemberExpiry ?? null,
    solidarityMembershipSource: data.solidarityMembershipSource,
    solidarityMembershipNotes: data.solidarityMembershipNotes.trim(),
    solidarityMembershipUpdatedAt: firestoreModule.serverTimestamp()
  });
}
