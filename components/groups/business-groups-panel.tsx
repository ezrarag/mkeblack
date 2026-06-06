"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useGroups } from "@/hooks/use-groups";

/**
 * Compact panel surfaced on a business profile, spotlighting visitor-run
 * community groups that have tagged this business — and inviting people to
 * start one if none exist yet.
 */
export function BusinessGroupsPanel({
  businessId,
  businessName
}: {
  businessId: string;
  businessName: string;
}) {
  const { groups, loading } = useGroups();

  const tagged = useMemo(
    () => groups.filter((group) => group.businessId === businessId).slice(0, 3),
    [groups, businessId]
  );

  if (loading) return null;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        Community groups
      </p>
      {tagged.length ? (
        <>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Visitor-run groups built around {businessName} — join in to swap
            recommendations, plan visits, and connect with regulars.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {tagged.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
              >
                {group.name}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm leading-7 text-stone-400">
          No community groups have tagged {businessName} yet — be the first to
          start a fan club, regulars&rsquo; crew, or planning circle for it.
        </p>
      )}
      <Link
        href="/groups"
        className="mt-4 inline-flex rounded-full border border-line bg-panelAlt/70 px-4 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-accent/35 hover:text-ink"
      >
        {tagged.length ? "Browse all groups →" : "Start a group →"}
      </Link>
    </div>
  );
}
