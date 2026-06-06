"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeReview, reviewIdFor } from "@/lib/firebase/reviews";
import { BusinessReview } from "@/lib/types";

/**
 * Subscribes to the signed-in visitor's own review of a business (if any),
 * keyed by the deterministic id `${businessId}_${authorUid}`. Lets the UI
 * switch between "Write a review" and "Edit your review" in real time.
 */
export function useMyReview(businessId: string | null, authorUid: string | null) {
  const [review, setReview] = useState<BusinessReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!businessId || !authorUid) {
      setReview(null);
      setLoading(false);
      return () => undefined;
    }

    async function start() {
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (cancelled) return;
        if (!db) {
          setLoading(false);
          return;
        }

        const id = reviewIdFor(businessId as string, authorUid as string);

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.doc(db, "reviews", id),
          (snapshot) => {
            setReview(snapshot.exists() ? normalizeReview(snapshot.data(), snapshot.id) : null);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load your review.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId, authorUid]);

  return { review, loading, error };
}
