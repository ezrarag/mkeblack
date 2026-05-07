"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { FavoriteRecord } from "@/lib/firebase/favorites";

export function useFavorites(uid: string | null) {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) {
      setFavorites([]);
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
          firestoreModule.query(
            firestoreModule.collection(db, "users", uid!, "favorites"),
            firestoreModule.orderBy("addedAt", "desc")
          ),
          (snapshot) => {
            if (!cancelled) {
              setFavorites(
                snapshot.docs.map((doc) => doc.data() as FavoriteRecord)
              );
              setLoading(false);
            }
          },
          (err) => {
            if (!cancelled) {
              setError(err);
              setLoading(false);
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  return { favorites, loading, error };
}
