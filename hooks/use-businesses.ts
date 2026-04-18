"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { Business } from "@/lib/types";

export function useBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
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

    const businessesQuery = query(
      collection(db, "businesses"),
      where("active", "==", true)
    );

    const unsubscribe = onSnapshot(
      businessesQuery,
      (snapshot) => {
        const nextBusinesses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Business[];

        nextBusinesses.sort((left, right) => left.name.localeCompare(right.name));

        setBusinesses(nextBusinesses);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { businesses, loading, error };
}
