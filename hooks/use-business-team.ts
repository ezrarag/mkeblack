"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import {
  normalizeBusinessTeamMemberRecord,
  sortBusinessTeamMembers
} from "@/lib/firebase/team";
import { BusinessTeamMember } from "@/lib/types";

type UseBusinessTeamOptions = {
  visibleOnly?: boolean;
};

export function useBusinessTeam(
  businessId: string,
  options: UseBusinessTeamOptions = {}
) {
  const { visibleOnly = false } = options;
  const [members, setMembers] = useState<BusinessTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
      if (!businessId) {
        setMembers([]);
        setLoading(false);
        return;
      }

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

        if (cancelled) {
          return;
        }

        if (!db) {
          setError("Firebase could not initialize in the current environment.");
          setLoading(false);
          return;
        }

        const collectionReference = firestoreModule.collection(
          db,
          "businesses",
          businessId,
          "team"
        );
        const teamQuery = visibleOnly
          ? firestoreModule.query(
              collectionReference,
              firestoreModule.where("visible", "==", true)
            )
          : collectionReference;

        unsubscribe = firestoreModule.onSnapshot(
          teamQuery,
          (snapshot) => {
            const nextMembers = sortBusinessTeamMembers(
              snapshot.docs.map((document) =>
                normalizeBusinessTeamMemberRecord(document.data(), document.id)
              )
            );
            setMembers(nextMembers);
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
              : "Unable to load team profiles."
          );
          setLoading(false);
        }
      }
    }

    setLoading(true);
    setError(null);
    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [businessId, visibleOnly]);

  return { members, loading, error };
}
