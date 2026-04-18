"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { sortHomepageModules, normalizeHomepageModule } from "@/lib/homepage";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { HomepageModule } from "@/lib/types";

export function useHomepageModules(visibleOnly = false) {
  const [modules, setModules] = useState<HomepageModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError("Firebase environment variables are missing.");
      setLoading(false);
      return;
    }

    const db = getFirebaseDb();

    if (!db) {
      setError("Firebase could not initialize in the current environment.");
      setLoading(false);
      return;
    }

    const modulesQuery = visibleOnly
      ? query(collection(db, "homepage_modules"), where("visible", "==", true))
      : collection(db, "homepage_modules");

    const unsubscribe = onSnapshot(
      modulesQuery,
      (snapshot) => {
        const nextModules = snapshot.docs.map((document) =>
          normalizeHomepageModule(document.data(), document.id)
        );

        setModules(
          sortHomepageModules(
            visibleOnly ? nextModules.filter((module) => module.visible) : nextModules
          )
        );
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [visibleOnly]);

  return { modules, loading, error };
}
