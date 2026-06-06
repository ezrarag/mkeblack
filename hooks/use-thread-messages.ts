"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeMessage } from "@/lib/firebase/messages";
import { Message } from "@/lib/types";

export function useThreadMessages(threadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!threadId) {
      setMessages([]);
      setLoading(false);
      return () => undefined;
    }

    const id = threadId;

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
          firestoreModule.query(
            firestoreModule.collection(db, "message_threads", id, "messages"),
            firestoreModule.orderBy("createdAt", "asc")
          ),
          (snapshot) => {
            const next = snapshot.docs.map((doc) =>
              normalizeMessage(doc.data(), doc.id, id)
            );
            setMessages(next);
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
  }, [threadId]);

  return { messages, loading, error };
}
