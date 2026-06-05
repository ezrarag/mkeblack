"use client";

import { useEffect, useState } from "react";
import { createFallbackBusinessCategories } from "@/lib/categories";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import {
  normalizeBusinessCategoryRecord,
  sortBusinessCategories
} from "@/lib/firebase/categories";
import { BusinessCategoryOption } from "@/lib/types";

export function useBusinessCategories() {
  const [categories, setCategories] = useState<BusinessCategoryOption[]>(
    createFallbackBusinessCategories
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
      if (!isFirebaseConfigured) {
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
          firestoreModule.collection(db, "business_categories"),
          (snapshot) => {
            const dynamicCategories = sortBusinessCategories(
              snapshot.docs.map((document) =>
                normalizeBusinessCategoryRecord(document.data(), document.id)
              )
            );
            setCategories(
              dynamicCategories.length
                ? dynamicCategories
                : createFallbackBusinessCategories()
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
              : "Unable to load business categories."
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

  return { categories, loading, error };
}
