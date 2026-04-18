import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { createEmptyBusinessForm } from "@/lib/constants";
import {
  getFirebaseDb,
  getFirebaseStorage
} from "@/lib/firebase/client";
import { geocodeAddress } from "@/lib/geocode";
import { BusinessFormValues } from "@/lib/types";
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
    photos: values.photos.filter(Boolean),
    ownerUid: values.ownerUid.trim(),
    active: Boolean(values.active),
    location: {
      lat: Number(values.location.lat),
      lng: Number(values.location.lng)
    }
  };
}

async function syncOwnerBusinessLink(ownerUid: string, businessId: string) {
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
      ...payload
    },
    { merge: true }
  );

  await syncOwnerBusinessLink(payload.ownerUid, businessId);
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
