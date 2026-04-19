"use client";

import { useEffect, useState } from "react";
import { normalizeBusinessRecord } from "@/lib/businesses";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { Business } from "@/lib/types";

export function useBusiness(id: string) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
      if (!id) {
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

        const reference = firestoreModule.doc(db, "businesses", id);
        unsubscribe = firestoreModule.onSnapshot(
          reference,
          (snapshot) => {
            if (!snapshot.exists()) {
              setBusiness(null);
              setLoading(false);
              return;
            }

            setBusiness(normalizeBusinessRecord(snapshot.data(), snapshot.id));
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
              : "Unable to load business."
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
  }, [id]);

  return { business, loading, error };
}
