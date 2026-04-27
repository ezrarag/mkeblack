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
      <div className={`relative shrink-0 overflow-hidden rounded-full border border-accent/35 ${sizeClassName}`}>
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
  if (!member.linkedinUrl && !member.instagramUrl) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {member.linkedinUrl ? (
        <a
          href={member.linkedinUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on LinkedIn`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panelAlt/70 text-xs font-semibold text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
        >
          in
        </a>
      ) : null}
      {member.instagramUrl ? (
        <a
          href={member.instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on Instagram`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panelAlt/70 text-xs font-semibold text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
        >
          IG
        </a>
      ) : null}
    </div>
  );
}

function TeamMemberCard({ member }: { member: BusinessTeamMember }) {
  return (
    <div className="rounded-[1.8rem] border border-line bg-panelAlt/65 p-5">
      <div className="flex items-start gap-4">
        <TeamPhoto member={member} sizeClassName="h-16 w-16" />
        <div>
          <p className="font-medium text-stone-100">{member.name}</p>
          <span className="mt-2 inline-flex rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs text-accentSoft">
            {member.role}
          </span>
        </div>
      </div>
      {member.bio ? (
        <p className="mt-4 line-clamp-3 text-sm leading-7 text-stone-300">
          {member.bio}
        </p>
      ) : null}
      <SocialLinks member={member} />
    </div>
  );
}

export function BusinessTeamSection({ business }: BusinessTeamSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { members, loading, error } = useBusinessTeam(business.id, {
    visibleOnly: true
  });

  if (!business.hasTeamProfiles) {
    return null;
  }

  if (loading) {
    return (
      <div className="mt-6 h-40 animate-pulse rounded-[2.4rem] border border-line bg-panel/70" />
    );
  }

  if (error || !members.length) {
    return null;
  }

  const owner = members.find((member) => member.isOwner) ?? members[0];
  const remainingMembers = members.filter((member) => member.id !== owner.id);
  const heading =
    members.length === 1 && owner.isOwner ? "Meet the owner" : "Meet the team";

  return (
    <div className="mt-6 rounded-[2.4rem] border border-line bg-panel/80 p-6">
      <p className="text-sm uppercase tracking-[0.26em] text-accentSoft">
        {heading}
      </p>

      <div className="mt-5 rounded-[1.8rem] border border-accent/25 bg-accent/10 p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <TeamPhoto member={owner} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-3xl text-ink">{owner.name}</h2>
              <span className="rounded-full border border-accent/35 bg-canvas/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accentSoft">
                {owner.role || "Owner"}
              </span>
            </div>
            {owner.bio ? (
              <p className="mt-4 text-sm leading-8 text-stone-300">{owner.bio}</p>
            ) : null}
            <SocialLinks member={owner} />
          </div>
        </div>
      </div>

      {remainingMembers.length ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
          >
            {expanded ? "Hide full team" : "See the full team"}
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
