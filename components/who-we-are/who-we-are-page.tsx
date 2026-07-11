"use client";

import Image from "next/image";
import { useState } from "react";
import { teamMembers, type TeamMember } from "@/lib/data/team";
import { usePageHeroContent } from "@/hooks/use-page-hero-content";

export const WHO_WE_ARE_HERO_DEFAULTS = {
  eyebrow: "Who We Are",
  headline: "The People Behind MKE Black",
  description: "A dedicated team of community builders, advocates, and leaders driving Black economic empowerment in Milwaukee and beyond. Tap any card to read their full bio."
};

// ── Initials helper ──────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Member card ───────────────────────────────────────────────────────────────
// Default state: photo fills the card background with name/role overlaid.
// On click: card expands to show the bio panel sliding up from the bottom.

function MemberCard({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(member.name);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      aria-label={`${open ? "Close" : "Open"} profile for ${member.name}`}
      className="group relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      {/* ── Photo or initials fallback ── */}
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105"
        aria-hidden="true"
      >
        {member.photoUrl ? (
          <Image
            src={member.photoUrl}
            alt={member.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover object-top"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent/10">
            <span className="font-display text-5xl font-black text-accent/40">
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* ── Always-visible gradient + name strip at bottom ── */}
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-400 ${
          open ? "top-0" : "top-1/2"
        }`}
      >
        <div className="max-h-full overflow-y-auto px-4 pb-4 pt-6">
          {/* Name */}
          <p className="font-display text-base font-bold leading-snug text-white sm:text-lg">
            {member.name}
          </p>
          {/* Role */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {member.role}
          </p>

          {/* Bio — slides in when open */}
          <div
            className={`grid transition-all duration-400 ease-out ${
              open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <p className="text-sm leading-relaxed text-white/90">{member.bio}</p>
            </div>
          </div>

          {/* Tap hint */}
          <p
            className={`mt-2 text-[10px] uppercase tracking-[0.2em] text-white/60 transition-opacity duration-300 ${
              open ? "opacity-0" : "opacity-100 group-hover:opacity-60"
            }`}
          >
            Tap to read bio
          </p>
        </div>
      </div>

      {/* ── Close indicator when open ── */}
      {open && (
        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-xs text-white">
          ✕
        </div>
      )}
    </button>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  label,
  members,
}: {
  label: string;
  members: TeamMember[];
}) {
  if (!members.length) return null;
  return (
    <div className="mt-14">
      <div className="flex items-center gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
          {label}
        </p>
        <div className="h-px flex-1 bg-line/60" />
      </div>
      <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {members.map((member) => (
          <MemberCard key={member.name} member={member} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WhoWeArePage() {
  const hero = usePageHeroContent("who_we_are_page", WHO_WE_ARE_HERO_DEFAULTS);
  const staff    = teamMembers.filter((m) => m.group === "staff");
  const board    = teamMembers.filter((m) => m.group === "board");
  const advisory = teamMembers.filter((m) => m.group === "advisory");

  return (
    <main>
      {/* Hero */}
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
            {hero.eyebrow}
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            {hero.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            {hero.description}
          </p>
        </div>
      </section>

      {/* Team grid */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        <GroupSection label="Staff" members={staff} />
        <GroupSection label="Board of Directors" members={board} />
        <GroupSection label="Advisory Board" members={advisory} />
      </section>
    </main>
  );
}
