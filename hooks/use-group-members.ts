"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { normalizeGroupMember } from "@/lib/firebase/groups";
import { GroupMember } from "@/lib/types";

/**
 * Subscribes to a group's member roster. Also derives the signed-in
 * visitor's own membership (and whether they're the owner) so the UI can
 * toggle Join / Leave / "you're the owner" states in real time.
 */
export function useGroupMembers(groupId: string | null, selfUid: string | null) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    if (!groupId) {
      setMembers([]);
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
          firestoreModule.collection(db, "groups", groupId as string, "members"),
          (snapshot) => {
            const next = snapshot.docs.map((doc) =>
              normalizeGroupMember(doc.data(), doc.id, groupId as string)
            );
            next.sort((a, b) => {
              if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
              const ta = a.joinedAt?.getTime() ?? 0;
              const tb = b.joinedAt?.getTime() ?? 0;
              return ta - tb;
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
          setError(err instanceof Error ? err.message : "Failed to load members.");
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

  const self = useMemo(
    () => (selfUid ? members.find((member) => member.uid === selfUid) ?? null : null),
    [members, selfUid]
  );

  return {
    members,
    count: members.length,
    self,
    isMember: !!self,
    isOwner: self?.role === "owner",
    loading,
    error
  };
}
