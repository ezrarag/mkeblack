"use client";

import { useEffect, useState } from "react";
import {
  normalizeMemberDiscount,
  sortMemberDiscounts
} from "@/lib/homepage";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { MemberDiscount } from "@/lib/types";

export function useMemberDiscounts(activeOnly = false) {
  const [discounts, setDiscounts] = useState<MemberDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
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

        const discountsQuery = activeOnly
          ? firestoreModule.query(
              firestoreModule.collection(db, "member_discounts"),
              firestoreModule.where("active", "==", true)
            )
          : firestoreModule.collection(db, "member_discounts");

        unsubscribe = firestoreModule.onSnapshot(
          discountsQuery,
          (snapshot) => {
            const nextDiscounts = snapshot.docs.map((document) =>
              normalizeMemberDiscount(document.data(), document.id)
            );

            setDiscounts(
              sortMemberDiscounts(
                activeOnly
                  ? nextDiscounts.filter((discount) => discount.active)
                  : nextDiscounts
              )
            );
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
              : "Unable to load member discounts."
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
  }, [activeOnly]);

  return { discounts, loading, error };
}
