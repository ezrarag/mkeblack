import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeRevenueShareLedgerEntry } from "@/lib/firebase/marketplace";

export async function markRevenueSharePaidOut(entryId: string) {
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
    firestoreModule.doc(db, "revenue_share_ledger", entryId),
    {
      status: "paid_out",
      paidOutAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}

export { normalizeRevenueShareLedgerEntry };
