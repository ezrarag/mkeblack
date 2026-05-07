import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { Business } from "@/lib/types";

export type FavoriteRecord = {
  businessId: string;
  businessName: string;
  businessCategory: string;
  businessAddress: string;
  businessPhotoUrl: string;
  addedAt: Date | null;
};

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

export async function addFavorite(uid: string, business: Business) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.setDoc(
    firestoreModule.doc(db, "users", uid, "favorites", business.id),
    {
      businessId: business.id,
      businessName: business.name,
      businessCategory: business.category,
      businessAddress: business.address,
      businessPhotoUrl: business.photos[0] ?? "",
      addedAt: firestoreModule.serverTimestamp()
    }
  );
}

export async function removeFavorite(uid: string, businessId: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.deleteDoc(
    firestoreModule.doc(db, "users", uid, "favorites", businessId)
  );
}
