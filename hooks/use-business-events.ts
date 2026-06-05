"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { normalizeBusinessEvent } from "@/lib/firebase/events";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessEvent } from "@/lib/types";

type UseBusinessEventsOptions = {
  businessId?: string;
  publishedOnly?: boolean;
  enabled?: boolean;
};

export function useBusinessEvents(options?: UseBusinessEventsOptions) {
  const {
    businessId,
    publishedOnly = false,
    enabled = true
  } = options ?? {};
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    if (!enabled) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);
        if (!db || cancelled) return;

        // Single-field constraints keep this usable without composite indexes.
        // Secondary filtering/sorting stays client-side.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constraints: any[] = [];
        if (businessId) {
          constraints.push(firestoreModule.where("businessId", "==", businessId));
        } else if (publishedOnly) {
          constraints.push(firestoreModule.where("status", "==", "published"));
        }

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "events"),
            ...constraints
          ),
          (snapshot) => {
            if (cancelled) return;
            const nextEvents = snapshot.docs
              .map((doc) => normalizeBusinessEvent(doc.data(), doc.id))
              .filter((event) => !publishedOnly || event.status === "published")
              .sort(
                (left, right) =>
                  (left.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
                  (right.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
              );

            setEvents(nextEvents);
            setLoading(false);
          },
          (err) => {
            if (!cancelled) {
              setError(formatFirebaseError(err));
              setLoading(false);
            }
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(formatFirebaseError(err));
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId, enabled, publishedOnly]);

  return { events, loading, error };
}
