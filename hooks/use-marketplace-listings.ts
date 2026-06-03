"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { normalizeMarketplaceListing } from "@/lib/firebase/marketplace";
import { MarketplaceListing } from "@/lib/types";

type UseMarketplaceListingsOptions = {
  /** Filter to available-only listings (default: true) */
  availableOnly?: boolean;
  /** Filter to a single business */
  businessId?: string;
  /** Admin mode — no filters */
  adminAll?: boolean;
  /** Defer opening the Firestore listener until auth/access state is ready */
  enabled?: boolean;
};

export function useMarketplaceListings(
  options?: UseMarketplaceListingsOptions
) {
  const {
    availableOnly = true,
    businessId,
    adminAll = false,
    enabled = true
  } = options ?? {};

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    if (!enabled) {
      setListings([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);
        if (!db || cancelled) return;

        // Build a single-field query to avoid composite-index requirements.
        // All secondary filtering (featured, category, price) is done client-side.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraints: any[] = [];
        if (businessId) {
          constraints.push(
            firestoreModule.where("businessId", "==", businessId)
          );
        } else if (!adminAll && availableOnly) {
          constraints.push(
            firestoreModule.where("available", "==", true)
          );
        }

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "marketplace_listings"),
            ...constraints
          ),
          (snapshot) => {
            if (!cancelled) {
              const all = snapshot.docs.map((doc) =>
                normalizeMarketplaceListing(doc.data(), doc.id)
              );
              // Sort: featured first, then newest first
              all.sort((a, b) => {
                if (a.featured !== b.featured)
                  return a.featured ? -1 : 1;
                return (
                  (b.createdAt?.getTime() ?? 0) -
                  (a.createdAt?.getTime() ?? 0)
                );
              });
              setListings(all);
              setLoading(false);
            }
          },
          (err) => {
            if (!cancelled) {
              setError(formatFirebaseError(err));
              setLoading(false);
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(formatFirebaseError(err));
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [availableOnly, businessId, adminAll, enabled]);

  return { listings, loading, error };
}
