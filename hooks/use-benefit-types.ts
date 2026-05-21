"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { normalizeBenefitType } from "@/lib/firebase/members";
import { BenefitType } from "@/lib/types";

export function useBenefitTypes() {
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

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

        if (!db || cancelled) return;

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.collection(db, "benefit_types"),
          (snapshot) => {
            if (cancelled) return;
            const next = snapshot.docs.map((doc) =>
              normalizeBenefitType(doc.data(), doc.id)
            );
            next.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
            setBenefitTypes(next);
            setLoading(false);
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
          setError(err instanceof Error ? err.message : "Unable to load benefits.");
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { benefitTypes, loading, error };
}
