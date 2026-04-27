"use client";

import { useEffect, useState } from "react";
import { getMilwaukeeNeighborhoods } from "@/lib/firebase/neighborhoods";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { MilwaukeeNeighborhood } from "@/lib/types";

export function useNeighborhoods() {
  const [neighborhoods, setNeighborhoods] = useState<MilwaukeeNeighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const nextNeighborhoods = await getMilwaukeeNeighborhoods();

        if (!cancelled) {
          setNeighborhoods(nextNeighborhoods);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Milwaukee neighborhoods."
          );
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { neighborhoods, loading, error };
}
