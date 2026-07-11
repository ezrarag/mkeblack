import { getFirebaseDb, loadFirebaseFirestoreModule } from "@/lib/firebase/client";
import { PageHeroContent } from "@/lib/types";

export async function savePageHeroContent(id: string, content: PageHeroContent) {
  const [firestore, db] = await Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]);
  if (!db) throw new Error("Firestore is not available.");
  await firestore.setDoc(firestore.doc(db, "site_config", id), {
    id,
    eyebrow: content.eyebrow.trim(),
    headline: content.headline.trim(),
    description: content.description.trim(),
    updatedAt: firestore.serverTimestamp()
  }, { merge: true });
}
