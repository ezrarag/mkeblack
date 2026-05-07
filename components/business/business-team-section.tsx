"use client";

import Image from "next/image";
import { useState } from "react";
import { useBusinessTeam } from "@/hooks/use-business-team";
import { Business, BusinessTeamMember } from "@/lib/types";

type BusinessTeamSectionProps = {
  business: Business;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function TeamPhoto({
  member,
  sizeClassName = "h-20 w-20"
}: {
  member: BusinessTeamMember;
  sizeClassName?: string;
}) {
  if (member.photoUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border border-accent/35 ${sizeClassName}`}
      >
        <Image
          src={member.photoUrl}
          alt={member.name}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/10 font-display text-2xl text-accentSoft ${sizeClassName}`}
    >
      {getInitials(member.name) || "MB"}
    </div>
  );
}

function SocialLinks({ member }: { member: BusinessTeamMember }) {
  const links = [
    { url: member.linkedinUrl, label: "LinkedIn", short: "in" },
    { url: member.instagramUrl, label: "Instagram", short: "IG" },
    { url: member.facebookUrl, label: "Facebook", short: "FB" },
    { url: member.tiktokUrl, label: "TikTok", short: "TT" }
  ].filter((l) => Boolean(l.url));

  if (!links.length) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map(({ url, label, short }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panelAlt/70 text-xs font-semibold text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
        >
          {short}
        </a>
      ))}
    </div>
  );
}

function ContactLinks({ member }: { member: BusinessTeamMember }) {
  if (!member.displayContact) return null;

  const items = [
    member.email ? { href: `mailto:${member.email}`, label: member.email } : null,
    member.phone ? { href: `tel:${member.phone}`, label: member.phone } : null,
    member.website ? { href: member.website, label: member.website.replace(/^https?:\/\//, "") } : null
  ].filter(Boolean) as { href: string; label: string }[];

  if (!items.length) return null;

  return (
    <div className="mt-3 flex flex-col gap-1">
      {items.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          target={href.startsWith("mailto:") || href.startsWith("tel:") ? undefined : "_blank"}
          rel="noreferrer"
          className="text-xs text-accent transition hover:text-accentSoft"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

/** Large featured card used for owner and co-owner profiles */
function FeaturedMemberCard({ member }: { member: BusinessTeamMember }) {
  const displayTitle =
    member.roleType === "owner"
      ? (member.role || "Owner")
      : (member.role || "Co-owner");

  return (
    <div className="rounded-xl border border-accent/25 bg-accent/10 p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <TeamPhoto member={member} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl font-bold text-ink">
              {member.title ? `${member.title} ` : ""}
              {member.name}
            </h3>
            {member.pronouns ? (
              <span className="text-xs text-stone-500">({member.pronouns})</span>
            ) : null}
            <span className="rounded-full border border-accent/35 bg-canvas/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accentSoft">
              {displayTitle}
            </span>
          </div>
          {member.bio ? (
            <p className="mt-4 text-sm leading-8 text-stone-300">{member.bio}</p>
          ) : null}
          <ContactLinks member={member} />
          <SocialLinks member={member} />
        </div>
      </div>
    </div>
  );
}

/** Compact card used for regular team members */
function TeamMemberCard({ member }: { member: BusinessTeamMember }) {
  return (
    <div className="rounded-xl border border-line bg-panelAlt/65 p-5">
      <div className="flex items-start gap-4">
        <TeamPhoto member={member} sizeClassName="h-16 w-16" />
        <div>
          <p className="font-medium text-stone-100">
            {member.title ? `${member.title} ` : ""}
            {member.name}
          </p>
          {member.pronouns ? (
            <p className="text-xs text-stone-500">({member.pronouns})</p>
          ) : null}
          {member.role ? (
            <span className="mt-2 inline-flex rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs text-accentSoft">
              {member.role}
            </span>
          ) : null}
        </div>
      </div>
      {member.bio ? (
        <p className="mt-4 line-clamp-3 text-sm leading-7 text-stone-300">
          {member.bio}
        </p>
      ) : null}
      <ContactLinks member={member} />
      <SocialLinks member={member} />
    </div>
  );
}

/** Derive the public section heading from visible members */
function deriveHeading(members: BusinessTeamMember[]): string {
  const owners = members.filter((m) => m.roleType === "owner");
  const coOwners = members.filter((m) => m.roleType === "co_owner");
  const teamMembers = members.filter((m) => m.roleType === "team");

  // Any regular team members → "Meet the team"
  if (teamMembers.length > 0) return "Meet the team";

  // Only owners/co-owners
  if (owners.length === 1 && coOwners.length === 0) return "Meet the owner";
  return "Meet the owners";
}

export function BusinessTeamSection({ business }: BusinessTeamSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { members, loading, error } = useBusinessTeam(business.id, {
    visibleOnly: true
  });

  if (!business.hasTeamProfiles) return null;

  if (loading) {
    return (
      <div className="mt-6 h-40 animate-pulse rounded-2xl border border-line bg-panel/70" />
    );
  }

  if (error || !members.length) return null;

  const heading = deriveHeading(members);

  const featured = members.filter(
    (m) => m.roleType === "owner" || m.roleType === "co_owner"
  );
  const teamOnly = members.filter((m) => m.roleType === "team");

  // Fallback: if no explicit owner/co-owner exist (legacy data), treat first member as featured
  const featuredMembers =
    featured.length > 0 ? featured : members.slice(0, 1);
  const remainingMembers =
    featured.length > 0 ? teamOnly : members.slice(1);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
        {heading}
      </p>

      <div className="mt-5 space-y-4">
        {featuredMembers.map((member) => (
          <FeaturedMemberCard key={member.id} member={member} />
        ))}
      </div>

      {remainingMembers.length > 0 ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setExpanded((c) => !c)}
            className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
          >
            {expanded
              ? "Hide full team"
              : `See the full team (${remainingMembers.length})`}
          </button>

          {expanded ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {remainingMembers.map((member) => (
                <TeamMemberCard key={member.id} member={member} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
