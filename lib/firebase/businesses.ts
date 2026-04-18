import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  createClosedBusinessHours,
  createEmptyBusinessForm
} from "@/lib/constants";
import {
  createBusinessDuplicateKey,
  normalizeBusinessRecord
} from "@/lib/businesses";
import {
  getFirebaseDb,
  getFirebaseStorage
} from "@/lib/firebase/client";
import { geocodeAddress } from "@/lib/geocode";
import {
  Business,
  BusinessClaimInvite,
  BusinessFormValues
} from "@/lib/types";
import { normalizeUrl } from "@/lib/utils";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
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
    email: values.email.trim(),
    hoursText: values.hoursText.trim(),
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
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  if (!ownerUid) {
    return;
  }

  const userReference = doc(db, "users", ownerUid);
  const userSnapshot = await getDoc(userReference);

  if (!userSnapshot.exists()) {
    return;
  }

  await setDoc(
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
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

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

  await setDoc(
    doc(db, "businesses", businessId),
    {
      id: businessId,
      ...payload,
      ownerUid: payload.ownerUid || null
    },
    { merge: true }
  );

  await syncOwnerBusinessLink(payload.ownerUid || null, businessId);
}

export async function createBusiness(values: BusinessFormValues) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  const businessReference = doc(collection(db, "businesses"));
  await saveBusiness(businessReference.id, values);
  return businessReference.id;
}

export async function deleteBusiness(business: Pick<Business, "id" | "photos">) {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  if (storage) {
    for (const photoUrl of business.photos) {
      try {
        await deleteObject(ref(storage, photoUrl));
      } catch {
        // Ignore storage cleanup failures so Firestore deletion can continue.
      }
    }
  }

  await deleteDoc(doc(db, "businesses", business.id));
}

export async function uploadBusinessPhotos(businessId: string, files: File[]) {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  if (!db || !storage) {
    throw new Error("Firebase Storage is not available in this environment.");
  }

  if (!files.length) {
    return [];
  }

  const photoUrls: string[] = [];

  for (const file of files) {
    const timestamp = Date.now();
    const storageReference = ref(
      storage,
      `businesses/${businessId}/${timestamp}-${sanitizeFilename(file.name)}`
    );

    const snapshot = await uploadBytes(storageReference, file);
    photoUrls.push(await getDownloadURL(snapshot.ref));
  }

  await updateDoc(doc(db, "businesses", businessId), {
    photos: arrayUnion(...photoUrls)
  });

  return photoUrls;
}

export async function removeBusinessPhoto(businessId: string, photoUrl: string) {
  const db = getFirebaseDb();
  const storage = getFirebaseStorage();

  if (!db || !storage) {
    throw new Error("Firebase Storage is not available in this environment.");
  }

  try {
    await deleteObject(ref(storage, photoUrl));
  } catch {
    // Ignore storage cleanup failures so Firestore state can still be updated.
  }

  await updateDoc(doc(db, "businesses", businessId), {
    photos: arrayRemove(photoUrl)
  });
}

export async function setBusinessesActive(
  businessIds: string[],
  active: boolean
) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  for (const businessId of businessIds) {
    await setDoc(
      doc(db, "businesses", businessId),
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
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  const existingSnapshot = await getDocs(collection(db, "businesses"));
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
    const category = row.category.trim();
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
    const businessReference = doc(collection(db, "businesses"));

    await setDoc(doc(db, "businesses", businessReference.id), {
      id: businessReference.id,
      name,
      category,
      description: "",
      address,
      phone: row.phone?.trim() ?? "",
      website: normalizeUrl(row.website?.trim() ?? ""),
      email: row.email?.trim() ?? "",
      hoursText: row.hoursText?.trim() ?? "",
      hours: createClosedBusinessHours(),
      photos: [],
      ownerUid: null,
      active: true,
      source: "import",
      importedAt: serverTimestamp(),
      claimInviteStatus: "not_invited",
      claimInvitedAt: null,
      location: location ?? createEmptyBusinessForm().location
    });

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
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  if (!business.email.trim()) {
    throw new Error("Add an email address to this listing before sending an invite.");
  }

  const inviteUrl = `${appOrigin.replace(/\/$/, "")}/claim/${business.id}`;

  await setDoc(
    doc(db, "business_claim_invites", business.id),
    {
      id: business.id,
      businessId: business.id,
      businessName: business.name,
      email: business.email.trim(),
      status: "pending",
      createdAt: serverTimestamp(),
      claimedAt: null,
      claimedByUid: null
    },
    { merge: true }
  );

  await setDoc(
    doc(collection(db, "mail")),
    {
      to: [business.email.trim()],
      message: {
        subject: `Claim your MKE Black listing for ${business.name}`,
        text: `A listing for ${business.name} is ready to be claimed on MKE Black. Create your account here: ${inviteUrl}`,
        html: `<p>A listing for <strong>${business.name}</strong> is ready to be claimed on MKE Black.</p><p><a href="${inviteUrl}">Create your account and claim this listing</a></p>`
      }
    }
  );

  await setDoc(
    doc(db, "businesses", business.id),
    {
      claimInviteStatus: "pending",
      claimInvitedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function claimBusinessListing(
  invite: Pick<BusinessClaimInvite, "businessId" | "email">,
  uid: string
) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  await setDoc(
    doc(db, "users", uid),
    {
      uid,
      email: invite.email.trim(),
      role: "business",
      businessId: invite.businessId
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "businesses", invite.businessId),
    {
      ownerUid: uid,
      email: invite.email.trim(),
      claimInviteStatus: "claimed"
    },
    { merge: true }
  );

  await setDoc(
    doc(db, "business_claim_invites", invite.businessId),
    {
      status: "claimed",
      claimedAt: serverTimestamp(),
      claimedByUid: uid
    },
    { merge: true }
  );
}
