"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeMarketplaceListing } from "@/lib/firebase/marketplace";
import { MarketplaceListing } from "@/lib/types";

type UseMarketplaceListingsOptions = {
  /** Filter to available-only listings (default: true) */
  availableOnly?: boolean;
  /** Filter to a single business */
  businessId?: string;
  /** Admin mode — no filters */
  adminAll?: boolean;
};

export function useMarketplaceListings(
  options?: UseMarketplaceListingsOptions
) {
  const {
    availableOnly = true,
    businessId,
    adminAll = false
  } = options ?? {};

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
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
              setError(err.message);
              setLoading(false);
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load listings"
          );
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [availableOnly, businessId, adminAll]);

  return { listings, loading, error };
}
