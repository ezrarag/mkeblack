"use client";

import Link from "next/link";
import Image from "next/image";
import { useProfessional } from "@/hooks/use-professionals";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuth } from "@/components/providers/auth-provider";

export function ProfessionalProfilePage({ id }: { id: string }) {
  const { professional, loading, error } = useProfessional(id);
  const { businesses } = useAllBusinesses();
  const { user } = useAuth();
  if (loading) return <StatePanel title="Loading profile…" description="Gathering professional details and affiliations." />;
  if (error || !professional) return <StatePanel title="Professional profile not found" description={error ?? "This profile may not be public yet."} />;
  return <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="rounded-[2rem] border border-line bg-panel p-7 shadow-glow sm:p-10">
      <div className="flex flex-col gap-7 sm:flex-row sm:items-start">{professional.photoUrl ? <Image unoptimized src={professional.photoUrl} alt={professional.name} width={144} height={144} className="h-36 w-36 rounded-full object-cover" /> : <div className="grid h-36 w-36 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-5xl font-black text-accentSoft">{professional.name.slice(0, 1)}</div>}<div className="flex-1"><div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl font-black text-ink sm:text-5xl">{professional.name}</h1>{professional.verified ? <span className="rounded-full bg-success/15 px-3 py-1 text-xs text-green-300">Verified</span> : null}{professional.beamParticipant ? <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs text-amber-300">BEAM</span> : null}</div><p className="mt-3 text-xl text-stone-200">{professional.headline}</p><p className="mt-2 text-sm text-muted">{professional.location}</p><div className="mt-5 flex flex-wrap gap-2">{professional.industries.map((item) => <span key={item} className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs text-accentSoft">{item}</span>)}</div>{user?.uid === professional.uid ? <Link href="/professionals/new" className="mt-5 inline-block text-sm text-accentSoft">Edit your profile →</Link> : null}</div></div>
      {professional.bio ? <div className="mt-10 border-t border-line pt-8"><h2 className="font-display text-2xl font-bold text-ink">About</h2><p className="mt-4 whitespace-pre-wrap leading-8 text-stone-300">{professional.bio}</p></div> : null}
      {professional.skills.length ? <div className="mt-8"><h2 className="font-display text-xl font-bold text-ink">Skills and expertise</h2><div className="mt-4 flex flex-wrap gap-2">{professional.skills.map((skill) => <span key={skill} className="rounded-full bg-panelAlt px-4 py-2 text-sm text-stone-200">{skill}</span>)}</div></div> : null}
      {professional.affiliations.length ? <div className="mt-10 border-t border-line pt-8"><h2 className="font-display text-2xl font-bold text-ink">Business affiliations</h2><div className="mt-5 space-y-4">{professional.affiliations.map((affiliation) => { const business = affiliation.businessId ? businesses.find((item) => item.id === affiliation.businessId) : null; return <div key={affiliation.id} className="rounded-2xl border border-line bg-panelAlt/60 p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-ink">{affiliation.title || "Professional affiliation"}</h3>{business ? <Link href={`/business/${business.id}`} className="mt-1 inline-block text-accentSoft">{business.name} →</Link> : affiliation.organizationUrl ? <a href={affiliation.organizationUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accentSoft">{affiliation.organizationName} ↗</a> : <p className="mt-1 text-stone-300">{affiliation.organizationName}</p>}</div><p className="text-xs text-muted">{affiliation.startDate}{affiliation.startDate ? " – " : ""}{affiliation.current ? "Present" : affiliation.endDate}</p></div>{affiliation.description ? <p className="mt-3 text-sm leading-6 text-stone-400">{affiliation.description}</p> : null}</div>; })}</div></div> : null}
      <div className="mt-10 flex flex-wrap gap-3">{professional.linkedinUrl ? <a href={professional.linkedinUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line px-5 py-2.5 text-sm text-stone-200">LinkedIn ↗</a> : null}{professional.websiteUrl ? <a href={professional.websiteUrl} target="_blank" rel="noreferrer" className="rounded-full border border-line px-5 py-2.5 text-sm text-stone-200">Website ↗</a> : null}{professional.showContactEmail && professional.contactEmail ? <a href={`mailto:${professional.contactEmail}`} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white">Contact</a> : null}</div>
    </div>
  </section>;
}
