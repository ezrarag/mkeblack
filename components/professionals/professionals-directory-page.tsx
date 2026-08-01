"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useProfessionals } from "@/hooks/use-professionals";
import { StatePanel } from "@/components/ui/state-panel";

export function ProfessionalsDirectoryPage() {
  const { professionals, loading, error } = useProfessionals();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("all");
  const [availability, setAvailability] = useState("all");
  const industries = useMemo(() => Array.from(new Set(professionals.flatMap((item) => item.industries))).sort(), [professionals]);
  const visible = useMemo(() => professionals.filter((professional) => {
    const text = [professional.name, professional.headline, professional.location, ...professional.industries, ...professional.skills].join(" ").toLowerCase();
    return (!search.trim() || text.includes(search.trim().toLowerCase()))
      && (industry === "all" || professional.industries.includes(industry))
      && (availability === "all" || (availability === "work" ? professional.openToWork : professional.openToCollaboration));
  }).sort((left, right) => Number(right.verified) - Number(left.verified) || left.name.localeCompare(right.name)), [professionals, search, industry, availability]);

  return <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="rounded-[2rem] border border-line bg-panel/80 p-7 shadow-glow sm:p-10">
      <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">Milwaukee talent</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div><h1 className="font-display text-4xl font-black text-ink sm:text-6xl">Professional Directory</h1><p className="mt-4 max-w-3xl leading-8 text-stone-300">Discover Black professionals, expertise, leadership, and opportunities to collaborate across Milwaukee.</p></div>
        <Link href="/professionals/new" className="rounded-full bg-accent px-6 py-3 font-semibold text-white transition hover:bg-accent/85">Create your profile</Link>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-[1fr_240px_220px]">
        <input aria-label="Search professionals" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, skills, or expertise" className="rounded-2xl border border-line bg-panelAlt px-4 py-3 text-ink outline-none focus:border-accent" />
        <select value={industry} onChange={(event) => setIndustry(event.target.value)} className="rounded-2xl border border-line bg-panelAlt px-4 py-3 text-ink"><option value="all">All industries</option>{industries.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={availability} onChange={(event) => setAvailability(event.target.value)} className="rounded-2xl border border-line bg-panelAlt px-4 py-3 text-ink"><option value="all">All availability</option><option value="collaboration">Open to collaboration</option><option value="work">Open to opportunities</option></select>
      </div>
    </div>
    {loading ? <StatePanel title="Loading professionals…" description="Gathering verified professional profiles." /> : error ? <StatePanel title="Unable to load professionals" description={error} /> : visible.length === 0 ? <StatePanel title="No profiles match yet" description="Try broadening the search, or create the first profile in this category." /> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map((professional) => <Link key={professional.id} href={`/professionals/${professional.id}`} className="group rounded-[2rem] border border-line bg-panel p-6 transition hover:-translate-y-1 hover:border-accent/45">
      <div className="flex items-start gap-4">{professional.photoUrl ? <Image unoptimized src={professional.photoUrl} alt="" width={80} height={80} className="h-20 w-20 rounded-full object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-2xl font-black text-accentSoft">{professional.name.slice(0, 1)}</div>}<div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold text-ink">{professional.name}</h2>{professional.verified ? <span className="rounded-full bg-success/15 px-2 py-1 text-[10px] uppercase tracking-wider text-green-300">Verified</span> : null}</div><p className="mt-1 text-sm leading-6 text-stone-300">{professional.headline}</p><p className="mt-2 text-xs text-muted">{professional.location}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2">{professional.skills.slice(0, 4).map((skill) => <span key={skill} className="rounded-full border border-line bg-panelAlt px-3 py-1 text-xs text-stone-300">{skill}</span>)}</div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs">{professional.openToCollaboration ? <span className="text-accentSoft">Open to collaboration</span> : null}{professional.beamParticipant ? <span className="text-amber-300">BEAM participant</span> : null}</div>
    </Link>)}</div>}
  </section>;
}
