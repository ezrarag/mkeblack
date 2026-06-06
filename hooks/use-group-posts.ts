"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeGroupPost } from "@/lib/firebase/groups";
import { GroupPost } from "@/lib/types";

/** Subscribes to a group's post feed (newest first). */
export function useGroupPosts(groupId: string | null) {
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!groupId) {
      setPosts([]);
      setLoading(false);
      return () => undefined;
    }

    async function start() {
      if (!isFirebaseConfigured) {
        setError("Firebase not configured.");
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

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.collection(db, "groups", groupId as string, "posts"),
          (snapshot) => {
            const next = snapshot.docs
              .map((doc) => normalizeGroupPost(doc.data(), doc.id, groupId as string))
              .filter((post) => post.status !== "removed");
            next.sort((a, b) => {
              const ta = a.createdAt?.getTime() ?? 0;
              const tb = b.createdAt?.getTime() ?? 0;
              return tb - ta;
            });
            setPosts(next);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load posts.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [groupId]);

  return { posts, loading, error };
}
