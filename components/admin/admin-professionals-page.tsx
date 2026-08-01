"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getFirebaseDb, loadFirebaseFirestoreModule } from "@/lib/firebase/client";
import { normalizeProfessionalRecord } from "@/lib/professionals";
import { Professional } from "@/lib/types";

export function AdminProfessionalsPage() {
  const [profiles, setProfiles] = useState<Professional[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    void (async () => {
      const [firestore, db] = await Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]);
      if (!db) return;
      unsubscribe = firestore.onSnapshot(firestore.collection(db, "professionals"), (snapshot) => {
        setProfiles(snapshot.docs.map((doc) => normalizeProfessionalRecord(doc.data(), doc.id)).sort((a, b) => a.name.localeCompare(b.name)));
      }, (error) => setMessage(error.message));
    })();
    return () => unsubscribe();
  }, []);
  async function update(id: string, patch: Record<string, unknown>) {
    try {
      const [firestore, db] = await Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]);
      if (!db) return;
      await firestore.updateDoc(firestore.doc(db, "professionals", id), { ...patch, updatedAt: firestore.serverTimestamp() });
      setMessage("Professional profile updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
  }
  return <ProtectedRoute requireAdmin><section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="rounded-[2rem] border border-line bg-panel p-7"><p className="text-sm uppercase tracking-[0.3em] text-accentSoft">Admin</p><h1 className="mt-3 font-display text-4xl font-black">Professional profiles</h1><p className="mt-3 text-stone-300">Review identities and affiliations before making profiles visible in the public directory.</p></div>{message ? <p className="mt-5 rounded-2xl border border-line bg-panel p-4 text-sm">{message}</p> : null}<div className="mt-6 space-y-3">{profiles.map((profile) => <div key={profile.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-5"><div><div className="flex flex-wrap items-center gap-2"><Link href={`/professionals/${profile.id}`} className="font-semibold text-ink hover:text-accentSoft">{profile.name || "Unnamed profile"}</Link><span className={`rounded-full px-2 py-1 text-[10px] ${profile.verified ? "bg-success/15 text-green-300" : "bg-amber-400/15 text-amber-300"}`}>{profile.verified ? "Verified" : "Needs review"}</span></div><p className="mt-1 text-sm text-stone-400">{profile.headline} · {profile.affiliations.length} affiliation{profile.affiliations.length === 1 ? "" : "s"}</p></div><div className="flex gap-2"><button onClick={() => update(profile.id, { verified: !profile.verified })} className="rounded-full border border-line px-4 py-2 text-sm">{profile.verified ? "Unverify" : "Verify"}</button><button onClick={() => update(profile.id, { active: !profile.active })} className="rounded-full border border-line px-4 py-2 text-sm">{profile.active ? "Deactivate" : "Activate"}</button><button onClick={() => update(profile.id, { beamParticipant: !profile.beamParticipant })} className="rounded-full border border-line px-4 py-2 text-sm">{profile.beamParticipant ? "Remove BEAM" : "Mark BEAM"}</button></div></div>)}</div></section></ProtectedRoute>;
}
