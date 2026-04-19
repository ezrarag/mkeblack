"use client";

import { useEffect, useState } from "react";
import { normalizeBusinessClaimInvite } from "@/lib/businesses";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { BusinessClaimInvite } from "@/lib/types";

export function useBusinessClaimInvite(businessId: string) {
  const [invite, setInvite] = useState<BusinessClaimInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
      if (!businessId) {
        setLoading(false);
        return;
      }

      if (!isFirebaseConfigured) {
        setError("Firebase environment variables are missing.");
        setLoading(false);
        return;
      }

      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (cancelled) {
          return;
        }

        if (!db) {
          setError("Firebase could not initialize in the current environment.");
          setLoading(false);
          return;
        }

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.doc(db, "business_claim_invites", businessId),
          (snapshot) => {
            if (!snapshot.exists()) {
              setInvite(null);
              setLoading(false);
              return;
            }

            setInvite(normalizeBusinessClaimInvite(snapshot.data(), snapshot.id));
            setLoading(false);
          },
          (snapshotError) => {
            setError(snapshotError.message);
            setLoading(false);
          }
        );
      } catch (startError) {
        if (!cancelled) {
          setError(
            startError instanceof Error
              ? startError.message
              : "Unable to load claim invite."
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
  }, [businessId]);

  return { invite, loading, error };
}
