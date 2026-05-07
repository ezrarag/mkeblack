"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";

export function useIsFavorite(uid: string | null, businessId: string) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !businessId || !isFirebaseConfigured) {
      setIsFavorite(false);
      return;
    }

    setLoading(true);
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);
        if (!db || cancelled) return;

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.doc(db, "users", uid!, "favorites", businessId),
          (snapshot) => {
            if (!cancelled) {
              setIsFavorite(snapshot.exists());
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setIsFavorite(false);
              setLoading(false);
            }
          }
        );
      } catch {
        if (!cancelled) {
          setIsFavorite(false);
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, businessId]);

  return { isFavorite, loading };
}
