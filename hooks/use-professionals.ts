"use client";

import { useEffect, useState } from "react";
import { getFirebaseDb, isFirebaseConfigured, loadFirebaseFirestoreModule } from "@/lib/firebase/client";
import { normalizeProfessionalRecord } from "@/lib/professionals";
import { Professional } from "@/lib/types";

export function useProfessionals() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
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
        const [firestore, db] = await Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]);
        if (!db || cancelled) return;
        unsubscribe = firestore.onSnapshot(
          firestore.query(
            firestore.collection(db, "professionals"),
            firestore.where("active", "==", true),
            firestore.where("verified", "==", true)
          ),
          (snapshot) => {
            setProfessionals(snapshot.docs.map((doc) => normalizeProfessionalRecord(doc.data(), doc.id)));
            setLoading(false);
          },
          (nextError) => { setError(nextError.message); setLoading(false); }
        );
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load professionals.");
        setLoading(false);
      }
    }
    void start();
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  return { professionals, loading, error };
}

export function useProfessional(id: string) {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    async function start() {
      try {
        const [firestore, db] = await Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]);
        if (!db || !id) { setLoading(false); return; }
        unsubscribe = firestore.onSnapshot(firestore.doc(db, "professionals", id), (snapshot) => {
          setProfessional(snapshot.exists() ? normalizeProfessionalRecord(snapshot.data(), snapshot.id) : null);
          setLoading(false);
        }, (nextError) => { setError(nextError.message); setLoading(false); });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load this profile.");
        setLoading(false);
      }
    }
    void start();
    return () => unsubscribe();
  }, [id]);
  return { professional, loading, error };
}
