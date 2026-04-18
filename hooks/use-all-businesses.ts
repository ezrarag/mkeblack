"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { normalizeBusinessRecord } from "@/lib/businesses";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { Business } from "@/lib/types";

export function useAllBusinesses() {
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

    const unsubscribe = onSnapshot(
      collection(db, "businesses"),
      (snapshot) => {
        const nextBusinesses = snapshot.docs.map((document) =>
          normalizeBusinessRecord(document.data(), document.id)
        );

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
