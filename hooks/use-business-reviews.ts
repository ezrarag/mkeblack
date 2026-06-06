"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeReview } from "@/lib/firebase/reviews";
import { BusinessReview } from "@/lib/types";

/**
 * Subscribes to a business's published reviews (newest first) and computes
 * an average rating + count for display in the profile header.
 */
export function useBusinessReviews(businessId: string | null) {
  const [reviews, setReviews] = useState<BusinessReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!businessId) {
      setReviews([]);
      setLoading(false);
      return () => undefined;
    }

    async function start() {
      if (!isFirebaseConfigured) {
        setError("Firebase not configured.");
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
          setError("Firebase could not initialize.");
          setLoading(false);
          return;
        }

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "reviews"),
            firestoreModule.where("businessId", "==", businessId)
          ),
          (snapshot) => {
            const next = snapshot.docs
              .map((doc) => normalizeReview(doc.data(), doc.id))
              .filter((review) => review.status !== "removed");
            next.sort((a, b) => {
              const ta = a.createdAt?.getTime() ?? 0;
              const tb = b.createdAt?.getTime() ?? 0;
              return tb - ta;
            });
            setReviews(next);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reviews.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId]);

  const summary = useMemo(() => {
    const visible = reviews.filter((review) => review.status === "published");
    if (!visible.length) return { average: 0, count: 0 };
    const total = visible.reduce((sum, review) => sum + review.rating, 0);
    return { average: total / visible.length, count: visible.length };
  }, [reviews]);

  return { reviews, summary, loading, error };
}
