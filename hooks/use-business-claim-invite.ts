"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { normalizeBusinessClaimInvite } from "@/lib/businesses";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { BusinessClaimInvite } from "@/lib/types";

export function useBusinessClaimInvite(businessId: string) {
  const [invite, setInvite] = useState<BusinessClaimInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    if (!isFirebaseConfigured) {
      setError("Firebase environment variables are missing.");
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    if (!db) {
      setError("Firebase could not initialize in the current environment.");
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "business_claim_invites", businessId),
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

    return () => unsubscribe();
  }, [businessId]);

  return { invite, loading, error };
}
