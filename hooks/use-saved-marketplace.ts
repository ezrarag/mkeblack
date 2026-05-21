"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { normalizeSavedMarketplaceListing } from "@/lib/firebase/saved-marketplace";
import { SavedMarketplaceListing } from "@/lib/types";

export function useSavedMarketplace(uid: string | null) {
  const [savedListings, setSavedListings] = useState<SavedMarketplaceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) {
      setSavedListings([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    setLoading(true);

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (!db || cancelled) return;

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "users", uid!, "saved_marketplace"),
            firestoreModule.orderBy("savedAt", "desc")
          ),
          (snapshot) => {
            if (cancelled) return;
            setSavedListings(
              snapshot.docs.map((doc) =>
                normalizeSavedMarketplaceListing(doc.data(), doc.id)
              )
            );
            setLoading(false);
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

  return { savedListings, loading, error };
}

export function useIsSavedMarketplaceListing(
  uid: string | null,
  listingId: string
) {
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || !listingId || !isFirebaseConfigured) {
      setIsSaved(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;
    setLoading(true);

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (!db || cancelled) return;

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.doc(db, "users", uid!, "saved_marketplace", listingId),
          (snapshot) => {
            if (!cancelled) {
              setIsSaved(snapshot.exists());
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setIsSaved(false);
              setLoading(false);
            }
          }
        );
      } catch {
        if (!cancelled) {
          setIsSaved(false);
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, listingId]);

  return { isSaved, loading };
}
