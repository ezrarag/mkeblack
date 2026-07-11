"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb, isFirebaseConfigured, loadFirebaseFirestoreModule } from "@/lib/firebase/client";
import { PageHeroContent } from "@/lib/types";

export function usePageHeroContent(id: string, defaults: PageHeroContent) {
  const [content, setContent] = useState(defaults);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;
    void Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]).then(([firestore, db]) => {
      if (!db || cancelled) return;
      unsubscribe = firestore.onSnapshot(firestore.doc(db, "site_config", id), (snapshot) => {
        const data = snapshot.data() ?? {};
        setContent({
          eyebrow: typeof data.eyebrow === "string" && data.eyebrow.trim() ? data.eyebrow : defaults.eyebrow,
          headline: typeof data.headline === "string" && data.headline.trim() ? data.headline : defaults.headline,
          description: typeof data.description === "string" && data.description.trim() ? data.description : defaults.description
        });
      });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [defaults, id]);
  return content;
}
