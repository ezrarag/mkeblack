import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";

export type ContactReason =
  | "general"
  | "submit_business"
  | "partnership"
  | "correction"
  | "other";

export type ContactFormData = {
  reason: ContactReason;
  ownerName: string;
  ownerEmail: string;
  message: string;
  businessName?: string;
  businessOwner?: string;
  businessEmail?: string;
  phone?: string;
  address?: string;
  website?: string;
  description?: string;
};

export async function submitContactForm(data: ContactFormData): Promise<void> {
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

  await firestoreModule.addDoc(
    firestoreModule.collection(db, "contactSubmissions"),
    {
      ...data,
      submittedAt: firestoreModule.serverTimestamp()
    }
  );
}
