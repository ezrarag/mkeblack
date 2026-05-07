"use client";

import { useEffect, useState } from "react";
import {
  normalizeArticleSummary,
  sortArticleSummaries
} from "@/lib/homepage";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { ArticleSummary } from "@/lib/types";

export function useArticles() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
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

        if (cancelled) return;

        if (!db) {
          setError("Firebase could not initialize.");
          setLoading(false);
          return;
        }

        const articlesQuery = firestoreModule.query(
          firestoreModule.collection(db, "articles"),
          firestoreModule.where("published", "==", true)
        );

        unsubscribe = firestoreModule.onSnapshot(
          articlesQuery,
          (snapshot) => {
            const nextArticles = snapshot.docs.map((document) =>
              normalizeArticleSummary(document.data(), document.id)
            );
            setArticles(sortArticleSummaries(nextArticles));
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
              : "Unable to load articles."
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

  return { articles, loading, error };
}
