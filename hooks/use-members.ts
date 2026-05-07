"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeSolidarityMember } from "@/lib/firebase/members";
import { SolidarityMember } from "@/lib/types";

export function useMembers() {
  const [members, setMembers] = useState<SolidarityMember[]>([]);
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
          firestoreModule.collection(db, "members"),
          (snapshot) => {
            const next = snapshot.docs.map((doc) =>
              normalizeSolidarityMember(doc.data(), doc.id)
            );
            next.sort((a, b) => {
              const ta = a.joinedAt?.getTime() ?? 0;
              const tb = b.joinedAt?.getTime() ?? 0;
              return tb - ta;
            });
            setMembers(next);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load members.");
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

  return { members, loading, error };
}
