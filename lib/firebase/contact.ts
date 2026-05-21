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
  logoUrl?: string;
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

export async function submitNewsletterSignup(email: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firebase could not initialize.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "newsletter_subscribers", normalizedEmail),
    {
      email: normalizedEmail,
      source: "site_footer",
      subscribedAt: firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
}
