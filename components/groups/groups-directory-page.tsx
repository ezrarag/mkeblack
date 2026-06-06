"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupCard } from "@/components/groups/group-card";
import { GroupForm } from "@/components/groups/group-form";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { useGroups } from "@/hooks/use-groups";

export function GroupsDirectoryPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { groups, loading, error } = useGroups();
  const [searchTerm, setSearchTerm] = useState("");
  const [composing, setComposing] = useState(false);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) =>
      [group.name, group.description, group.businessName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [groups, searchTerm]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Community
        </p>
        <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink sm:text-5xl">
          Groups
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-stone-300">
          Fan clubs, regulars&rsquo; crews, neighborhood circles — these are
          community-run groups started by visitors like you, often built
          around a favorite Black-owned business. Start one, find your people,
          and keep the conversation going between visits.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {user ? (
            <button
              type="button"
              onClick={() => setComposing((current) => !current)}
              className="inline-flex rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
            >
              {composing ? "Close" : "Start a group"}
            </button>
          ) : (
            <Link
              href="/login?next=/groups"
              className="inline-flex rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
            >
              Sign in to start a group
            </Link>
          )}
        </div>
      </div>

      {composing && user ? (
        <div className="mt-6">
          <GroupForm
            authorUid={user.uid}
            authorName={profile?.displayName || user.displayName || user.email || "MKE Black member"}
            onSaved={(groupId) => {
              setComposing(false);
              router.push(`/groups/${groupId}`);
            }}
            onCancel={() => setComposing(false)}
          />
        </div>
      ) : null}

      <div className="mt-8">
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onInput={(event) => setSearchTerm(event.currentTarget.value)}
          placeholder="Search groups by name, business, or topic"
          className="max-w-md"
        />
      </div>

      {error ? (
        <div className="mt-8">
          <StatePanel title="Unable to load groups" description={error} />
        </div>
      ) : loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[260px] animate-pulse rounded-2xl border border-line bg-panel/70"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <StatePanel
            title={groups.length ? "No groups match that search" : "No groups yet"}
            description={
              groups.length
                ? "Try a different name, business, or topic."
                : "Be the first to start a community group around a favorite business or shared interest."
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}
