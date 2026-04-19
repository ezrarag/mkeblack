"use client";

import { useEffect, useState } from "react";
import { sortHomepageModules, normalizeHomepageModule } from "@/lib/homepage";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { HomepageModule } from "@/lib/types";

export function useHomepageModules(visibleOnly = false) {
  const [modules, setModules] = useState<HomepageModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
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

        const modulesQuery = visibleOnly
          ? firestoreModule.query(
              firestoreModule.collection(db, "homepage_modules"),
              firestoreModule.where("visible", "==", true)
            )
          : firestoreModule.collection(db, "homepage_modules");

        unsubscribe = firestoreModule.onSnapshot(
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
      } catch (startError) {
        if (!cancelled) {
          setError(
            startError instanceof Error
              ? startError.message
              : "Unable to load homepage modules."
          );
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [visibleOnly]);

  return { modules, loading, error };
}
