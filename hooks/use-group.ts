"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeGroup } from "@/lib/firebase/groups";
import { Group } from "@/lib/types";

/** Subscribes to a single group document by id, for the group detail page. */
export function useGroup(groupId: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!groupId) {
      setGroup(null);
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
          firestoreModule.doc(db, "groups", groupId as string),
          (snapshot) => {
            setGroup(snapshot.exists() ? normalizeGroup(snapshot.data(), snapshot.id) : null);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load this group.");
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

  return { group, loading, error };
}
