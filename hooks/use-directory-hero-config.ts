"use client";

import { useEffect, useState } from "react";
import {
  DIRECTORY_HERO_CONFIG_ID,
  normalizeDirectoryHeroConfig
} from "@/lib/directory-hero";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { DirectoryHeroConfig } from "@/lib/types";

export function useDirectoryHeroConfig() {
  const [config, setConfig] = useState<DirectoryHeroConfig>(
    normalizeDirectoryHeroConfig(null)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    async function start() {
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (!db || cancelled) {
          return;
        }

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.doc(db, "site_config", DIRECTORY_HERO_CONFIG_ID),
          (snapshot) => {
            if (cancelled) {
              return;
            }

            setConfig(
              normalizeDirectoryHeroConfig(
                snapshot.exists() ? snapshot.data() : null,
                snapshot.id
              )
            );
            setLoading(false);
          },
          (snapshotError) => {
            if (!cancelled) {
              setError(snapshotError.message);
              setLoading(false);
            }
          }
        );
      } catch (startError) {
        if (!cancelled) {
          setError(
            startError instanceof Error
              ? startError.message
              : "Unable to load directory hero."
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
  }, []);

  return { config, loading, error };
}

