"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { getLocalRecentViews, RecentViewRecord } from "@/lib/recent-views";

export function useRecentViews(uid: string | null) {
  const [views, setViews] = useState<RecentViewRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setViews(getLocalRecentViews());
      return;
    }

    if (!uid) {
      // Not signed in — use localStorage only
      setViews(getLocalRecentViews());
      return;
    }

    setLoading(true);
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    async function start() {
      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);
        if (!db || cancelled) return;

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.query(
            firestoreModule.collection(db, "users", uid!, "recent_views"),
            firestoreModule.orderBy("viewedAt", "desc"),
            firestoreModule.limit(20)
          ),
          (snapshot) => {
            if (!cancelled) {
              if (snapshot.empty) {
                // Fall back to localStorage if Firebase is empty
                setViews(getLocalRecentViews());
              } else {
                setViews(
                  snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                      businessId: doc.id,
                      businessName: String(data.businessName ?? ""),
                      businessCategory: String(data.businessCategory ?? ""),
                      businessAddress: String(data.businessAddress ?? ""),
                      businessPhotoUrl: String(data.businessPhotoUrl ?? ""),
                      viewedAt:
                        data.viewedAt?.toDate?.()?.toISOString() ??
                        new Date().toISOString()
                    } satisfies RecentViewRecord;
                  })
                );
              }
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setViews(getLocalRecentViews());
              setLoading(false);
            }
          }
        );
      } catch {
        if (!cancelled) {
          setViews(getLocalRecentViews());
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

  return { views, loading };
}
