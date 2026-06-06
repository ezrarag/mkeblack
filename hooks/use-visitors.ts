"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { UserProfile } from "@/lib/types";

export type VisitorRecord = UserProfile & {
  createdAt: Date | null;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * Loads every user with role:"visitor" for admin analytics. Firestore
 * security rules (isAdmin()) gate this — non-admins get an empty/error
 * result, never the data.
 */
export function useVisitors() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

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
            firestoreModule.collection(db, "users"),
            firestoreModule.where("role", "==", "visitor")
          ),
          (snapshot) => {
            const next = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                uid: doc.id,
                email: data.email ?? "",
                role: "visitor" as const,
                businessId: data.businessId ?? null,
                displayName: data.displayName ?? null,
                createdAt: toDate(data.createdAt),
                neighborhood: data.neighborhood ?? null,
                interests: Array.isArray(data.interests) ? data.interests : [],
                referralSource: data.referralSource ?? null
              } satisfies VisitorRecord;
            });
            next.sort((a, b) => {
              const ta = a.createdAt?.getTime() ?? 0;
              const tb = b.createdAt?.getTime() ?? 0;
              return tb - ta;
            });
            setVisitors(next);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load visitors.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { visitors, loading, error };
}
