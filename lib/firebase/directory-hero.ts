import {
  DIRECTORY_HERO_CONFIG_ID
} from "@/lib/directory-hero";
import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import { DirectoryHeroConfig } from "@/lib/types";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  return { db, firestoreModule };
}

async function getStorageHelpers() {
  const [storageModule, storage] = await Promise.all([
    loadFirebaseStorageModule(),
    getFirebaseStorage()
  ]);

  if (!storage) {
    throw new Error("Firebase Storage is not available in this environment.");
  }

  return { storage, storageModule };
}

export async function saveDirectoryHeroConfig(
  config: Pick<DirectoryHeroConfig, "heroImages"> | Pick<DirectoryHeroConfig, "eyebrow" | "headline" | "description">
) {
  const { db, firestoreModule } = await getFirestoreHelpers();

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "site_config", DIRECTORY_HERO_CONFIG_ID),
    {
      id: DIRECTORY_HERO_CONFIG_ID,
      ...config,
      updatedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

export async function uploadDirectoryHeroImage(file: File) {
  const { storage, storageModule } = await getStorageHelpers();
  const storageRef = storageModule.ref(
    storage,
    `assets/directory-hero/${Date.now()}-${sanitizeFilename(file.name)}`
  );
  const snapshot = await storageModule.uploadBytes(storageRef, file);
  return storageModule.getDownloadURL(snapshot.ref);
}
