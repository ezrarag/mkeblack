"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  normalizeMemberDiscount,
  sortMemberDiscounts
} from "@/lib/homepage";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { MemberDiscount } from "@/lib/types";

export function useMemberDiscounts(activeOnly = false) {
  const [discounts, setDiscounts] = useState<MemberDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    const discountsQuery = activeOnly
      ? query(collection(db, "member_discounts"), where("active", "==", true))
      : collection(db, "member_discounts");

    const unsubscribe = onSnapshot(
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

    return () => unsubscribe();
  }, [activeOnly]);

  return { discounts, loading, error };
}
