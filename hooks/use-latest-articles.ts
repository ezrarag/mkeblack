"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  isPublishedArticle,
  normalizeArticleSummary,
  sortArticleSummaries
} from "@/lib/homepage";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { ArticleSummary } from "@/lib/types";

export function useLatestArticles(limitCount = 3) {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
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
      collection(db, "articles"),
      (snapshot) => {
        const nextArticles = snapshot.docs
          .filter((document) => isPublishedArticle(document.data()))
          .map((document) => normalizeArticleSummary(document.data(), document.id));

        setArticles(sortArticleSummaries(nextArticles).slice(0, limitCount));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [limitCount]);

  return { articles, loading, error };
}
