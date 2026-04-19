"use client";

import { useEffect, useState } from "react";
import { normalizeBusinessRecord } from "@/lib/businesses";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { Business } from "@/lib/types";

export function useAllBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
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

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.collection(db, "businesses"),
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
      } catch (startError) {
        if (!cancelled) {
          setError(
            startError instanceof Error
              ? startError.message
              : "Unable to load businesses."
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
  }, []);

  return { businesses, loading, error };
}
