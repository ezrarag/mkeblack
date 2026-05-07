import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

/**
 * Creates or updates a visitor profile document.
 * Only sets role:"visitor" if the user has no existing profile or already
 * has role:"visitor" — preserves existing business/admin roles.
 */
export async function createOrUpdateVisitorProfile(
  uid: string,
  displayName: string,
  email: string
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const ref = firestoreModule.doc(db, "users", uid);
  const snapshot = await firestoreModule.getDoc(ref);

  if (snapshot.exists()) {
    const existing = snapshot.data();
    // Only touch displayName/email; never downgrade a business/admin role
    if (existing.role === "business" || existing.role === "admin") {
      await firestoreModule.setDoc(
        ref,
        { displayName, email },
        { merge: true }
      );
      return;
    }
  }

  await firestoreModule.setDoc(
    ref,
    {
      uid,
      email,
      displayName,
      role: "visitor",
      businessId: null
    },
    { merge: true }
  );
}
