"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeMessageThread } from "@/lib/firebase/messages";
import { MessageThread } from "@/lib/types";

type ThreadSide = "visitor" | "business";

/**
 * Subscribes to message threads for either side of a conversation:
 *  - "visitor": threads where this uid is the visitor
 *  - "business": threads for a given businessId (the owner's inbox)
 *
 * `key` is the visitor uid or the businessId depending on `side`.
 */
export function useMessageThreads(side: ThreadSide, key: string | null) {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!key) {
      setThreads([]);
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

        const field = side === "visitor" ? "visitorUid" : "businessId";

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "message_threads"),
            firestoreModule.where(field, "==", key)
          ),
          (snapshot) => {
            const next = snapshot.docs.map((doc) =>
              normalizeMessageThread(doc.data(), doc.id)
            );
            next.sort((a, b) => {
              const ta = a.lastMessageAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
              const tb = b.lastMessageAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
              return tb - ta;
            });
            setThreads(next);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load messages.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [side, key]);

  return { threads, loading, error };
}
