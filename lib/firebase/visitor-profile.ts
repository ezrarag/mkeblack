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
 *
 * Stamps `createdAt` exactly once, on first creation, so admins can see
 * signup trends over time. Never overwrites it on subsequent sign-ins.
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
    // and never stomp on createdAt or opt-in fields the user has set.
    if (existing.role === "business" || existing.role === "admin") {
      await firestoreModule.setDoc(
        ref,
        { displayName, email },
        { merge: true }
      );
      return;
    }

    await firestoreModule.setDoc(
      ref,
      {
        displayName,
        email,
        ...(existing.createdAt
          ? {}
          : { createdAt: firestoreModule.serverTimestamp() })
      },
      { merge: true }
    );
    return;
  }

  await firestoreModule.setDoc(
    ref,
    {
      uid,
      email,
      displayName,
      role: "visitor",
      businessId: null,
      createdAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

export type VisitorProfileDetails = {
  neighborhood: string | null;
  interests: string[];
  referralSource: string | null;
};

/**
 * Self-service update for the optional/opt-in fields a visitor can fill in
 * from their dashboard ("About you"). Visitors may only write their own
 * document — enforced by firestore.rules (isSelf(uid) || isAdmin()).
 */
export async function updateVisitorProfileDetails(
  uid: string,
  details: Partial<VisitorProfileDetails>
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const ref = firestoreModule.doc(db, "users", uid);
  await firestoreModule.setDoc(ref, details, { merge: true });
}
