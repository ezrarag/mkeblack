"use client";

import Image from "next/image";
import Link from "next/link";
import { useGroupMembers } from "@/hooks/use-group-members";
import { Group } from "@/lib/types";

export function GroupCard({ group }: { group: Group }) {
  const { count } = useGroupMembers(group.id, null);

  return (
    <Link
      href={`/groups/${group.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-panel/70 transition hover:border-accent/35 hover:bg-panel"
    >
      <div className="relative h-32 w-full bg-panelAlt/60">
        {group.coverPhotoUrl ? (
          <Image
            src={group.coverPhotoUrl}
            alt={group.name}
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            className="object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-3xl">👥</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="font-display text-lg font-bold text-ink">{group.name}</p>
        {group.businessName ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-accentSoft">
            {group.businessName}
          </p>
        ) : null}
        {group.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-400">{group.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-stone-500">
          {count} member{count === 1 ? "" : "s"} · started by {group.creatorName}
        </p>
      </div>
    </Link>
  );
}
