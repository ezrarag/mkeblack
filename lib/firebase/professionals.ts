import { Professional } from "@/lib/types";
import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";

export type ProfessionalProfileInput = Omit<
  Professional,
  | "id" | "createdAt" | "updatedAt" | "verified" | "tierLevel"
  | "subscriptionActive" | "stripeCustomerId" | "stripeConnectAccountId"
  | "referralPercentage" | "visitorCount" | "interactionLog" | "externalSync"
>;

export async function saveProfessionalProfile(uid: string, profile: ProfessionalProfileInput) {
  const [firestore, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firebase is not configured.");
  const reference = firestore.doc(db, "professionals", uid);
  const snapshot = await firestore.getDoc(reference);
  const protectedDefaults = snapshot.exists() ? {} : {
    verified: false,
    tierLevel: "free",
    subscriptionActive: false,
    stripeCustomerId: "",
    stripeConnectAccountId: "",
    referralPercentage: 0,
    visitorCount: 0,
    interactionLog: [],
    externalSync: {},
    createdAt: firestore.serverTimestamp()
  };
  await firestore.setDoc(reference, {
    ...profile,
    uid,
    ...protectedDefaults,
    updatedAt: firestore.serverTimestamp()
  }, { merge: true });
  return uid;
}

export async function uploadProfessionalPhoto(uid: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Profile photos must be 5 MB or smaller.");
  const [storageModule, storage] = await Promise.all([
    loadFirebaseStorageModule(),
    getFirebaseStorage()
  ]);
  if (!storage) throw new Error("Firebase Storage is not configured.");
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const reference = storageModule.ref(storage, `professionals/${uid}/profile.${extension}`);
  await storageModule.uploadBytes(reference, file, { contentType: file.type });
  return storageModule.getDownloadURL(reference);
}
