"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import {
  normalizeBusinessTagRecord,
  sortBusinessTags
} from "@/lib/firebase/tags";
import { BusinessTag } from "@/lib/types";

export function useBusinessTags() {
  const [tags, setTags] = useState<BusinessTag[]>([]);
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
          firestoreModule.collection(db, "business_tags"),
          (snapshot) => {
            const nextTags = sortBusinessTags(
              snapshot.docs.map((document) =>
                normalizeBusinessTagRecord(document.data(), document.id)
              )
            );
            setTags(nextTags);
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
              : "Unable to load business tags."
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

  return { tags, loading, error };
}
