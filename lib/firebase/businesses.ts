import {
  createClosedBusinessHours,
  createEmptyBusinessForm
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
import {
  Business,
  BusinessClaimInvite,
  BusinessFormValues
} from "@/lib/types";
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

export function normalizeBusinessPayload(values: BusinessFormValues) {
  return {
    ...values,
    name: values.name.trim(),
    category: values.category.trim(),
    description: values.description.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
    website: normalizeUrl(values.website.trim()),
    instagramReelUrl: normalizeUrl(values.instagramReelUrl.trim()),
    email: values.email.trim(),
    hoursText: values.hoursText.trim(),
    neighborhood: values.neighborhood.trim(),
    tags: normalizeTagSlugs(values.tags),
    photos: values.photos.filter(Boolean),
    ownerUid: values.ownerUid.trim(),
    active: Boolean(values.active),
    source: values.source,
    location: {
      lat: Number(values.location.lat),
      lng: Number(values.location.lng)
    }
  };
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
      businessId
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
  const previousTags = previousSnapshot.exists()
    ? normalizeTagSlugs(previousSnapshot.data().tags)
    : [];
  const payload = normalizeBusinessPayload(values);

  if (!payload.address) {
    payload.location = values.location;
  } else if (
    payload.address !== previousAddress ||
    !Number.isFinite(payload.location.lat) ||
    !Number.isFinite(payload.location.lng)
  ) {
    const geocodedLocation = await geocodeAddress(payload.address);

    if (geocodedLocation) {
      payload.location = geocodedLocation;
    }
  }

  const neighborhoods = await getMilwaukeeNeighborhoods();
  payload.neighborhood =
    getNeighborhoodForPoint(
      payload.location.lat,
      payload.location.lng,
      neighborhoods
    ) ?? payload.neighborhood;

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
  await syncOwnerBusinessLink(payload.ownerUid || null, businessId);
}

export async function createBusiness(values: BusinessFormValues) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const businessReference = firestoreModule.doc(
    firestoreModule.collection(db, "businesses")
  );

  await saveBusiness(businessReference.id, values);
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

    await firestoreModule.setDoc(firestoreModule.doc(db, "businesses", businessReference.id), {
      id: businessReference.id,
      name,
      category,
      description: "",
      address,
      phone,
      website: normalizeUrl(row.website?.trim() ?? ""),
      instagramReelUrl: "",
      email: row.email?.trim() ?? "",
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
      hasTeamProfiles: false,
      source: "import",
      importedAt: firestoreModule.serverTimestamp(),
      claimInviteStatus: "not_invited",
      claimInvitedAt: null,
      location: location ?? createEmptyBusinessForm().location
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

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "users", uid),
    {
      uid,
      email: invite.email.trim(),
      role: "business",
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
