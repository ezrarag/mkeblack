"use client";

import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useVisitors, VisitorRecord } from "@/hooks/use-visitors";

function fmtDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short"
  });
}

type Tally = { label: string; count: number };

function tallyOf(values: (string | null | undefined)[]): Tally[] {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function BreakdownCard({
  title,
  tallies,
  total,
  emptyHint
}: {
  title: string;
  tallies: Tally[];
  total: number;
  emptyHint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
        {title}
      </p>
      {tallies.length ? (
        <div className="mt-4 space-y-2.5">
          {tallies.slice(0, 8).map((t) => (
            <div key={t.label}>
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span className="truncate pr-2">{t.label}</span>
                <span className="shrink-0 text-stone-500">{t.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panelAlt">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${total ? Math.round((t.count / total) * 100) : 0}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-500">{emptyHint}</p>
      )}
    </div>
  );
}

function VisitorRow({ visitor }: { visitor: VisitorRecord }) {
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-100">
            {visitor.displayName || "(no name)"}
          </p>
          <p className="truncate text-sm text-stone-400">{visitor.email}</p>
        </div>
        <span className="shrink-0 text-xs text-stone-500">
          Joined {fmtDate(visitor.createdAt)}
        </span>
      </div>
      {(visitor.neighborhood || visitor.referralSource || visitor.interests?.length) ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visitor.neighborhood ? (
            <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
              📍 {visitor.neighborhood}
            </span>
          ) : null}
          {visitor.referralSource ? (
            <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
              via {visitor.referralSource}
            </span>
          ) : null}
          {(visitor.interests ?? []).map((interest) => (
            <span
              key={interest}
              className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-accentSoft"
            >
              {interest}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminVisitorsPage() {
  const { visitors, loading, error } = useVisitors();
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const total = visitors.length;
    const withCreatedAt = visitors.filter((v) => v.createdAt);
    const optedIn = visitors.filter(
      (v) => v.neighborhood || v.referralSource || v.interests?.length
    ).length;

    const monthly = new Map<string, number>();
    for (const v of withCreatedAt) {
      const key = monthKey(v.createdAt as Date);
      monthly.set(key, (monthly.get(key) ?? 0) + 1);
    }
    const months = Array.from(monthly.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-6);
    const maxMonthly = months.reduce((max, [, count]) => Math.max(max, count), 0);

    const neighborhoods = tallyOf(visitors.map((v) => v.neighborhood));
    const referralSources = tallyOf(visitors.map((v) => v.referralSource));
    const interests = tallyOf(visitors.flatMap((v) => v.interests ?? []));

    return {
      total,
      optedIn,
      months,
      maxMonthly,
      neighborhoods,
      referralSources,
      interests
    };
  }, [visitors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter(
      (v) =>
        v.email.toLowerCase().includes(q) ||
        (v.displayName ?? "").toLowerCase().includes(q) ||
        (v.neighborhood ?? "").toLowerCase().includes(q)
    );
  }, [visitors, search]);

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accentSoft">
          Admin
        </p>
        <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink sm:text-5xl">
          Visitor accounts
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
          Aggregate insight into who&rsquo;s signing up to use the directory.
          Demographic fields are entirely opt-in — visitors choose to share
          them from their dashboard, and they&rsquo;re never shown publicly.
        </p>

        {error ? (
          <div className="mt-6">
            <StatePanel title="Couldn't load visitors" description={error} />
          </div>
        ) : loading ? (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-panel/60" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Top stats ── */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Total visitor accounts
                </p>
                <p className="mt-2 font-display text-3xl font-black text-ink">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Shared &ldquo;About you&rdquo; info
                </p>
                <p className="mt-2 font-display text-3xl font-black text-ink">
                  {stats.optedIn}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {stats.total
                    ? `${Math.round((stats.optedIn / stats.total) * 100)}% opt-in rate`
                    : "No visitors yet"}
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  New this month
                </p>
                <p className="mt-2 font-display text-3xl font-black text-ink">
                  {stats.months.length
                    ? stats.months[stats.months.length - 1][1]
                    : 0}
                </p>
              </div>
            </div>

            {/* ── Signups over time ── */}
            <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                Signups by month
              </p>
              {stats.months.length ? (
                <div className="mt-4 flex items-end gap-3">
                  {stats.months.map(([key, count]) => (
                    <div key={key} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-panelAlt">
                        <div
                          className="w-full rounded-t-lg bg-accent transition-all"
                          style={{
                            height: `${stats.maxMonthly ? Math.max(8, Math.round((count / stats.maxMonthly) * 100)) : 0}%`
                          }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-ink">{count}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
                        {monthLabel(key)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-500">
                  No signup history yet — this fills in as new visitor accounts
                  are created (createdAt is stamped automatically going forward).
                </p>
              )}
            </div>

            {/* ── Breakdowns ── */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <BreakdownCard
                title="Neighborhoods"
                tallies={stats.neighborhoods}
                total={stats.neighborhoods.reduce((sum, t) => sum + t.count, 0)}
                emptyHint="No visitors have shared a neighborhood yet."
              />
              <BreakdownCard
                title="Interests"
                tallies={stats.interests}
                total={visitors.length}
                emptyHint="No visitors have picked interests yet."
              />
              <BreakdownCard
                title="How they found us"
                tallies={stats.referralSources}
                total={stats.referralSources.reduce((sum, t) => sum + t.count, 0)}
                emptyHint="No visitors have shared a referral source yet."
              />
            </div>

            {/* ── List ── */}
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">
                  All visitors ({filtered.length})
                </h2>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, neighborhood…"
                  className="w-full max-w-xs rounded-xl border border-line bg-panelAlt/70 px-4 py-2.5 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {filtered.length ? (
                <div className="mt-4 space-y-3">
                  {filtered.map((visitor) => (
                    <VisitorRow key={visitor.uid} visitor={visitor} />
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <StatePanel
                    title="No visitors found"
                    description={
                      visitors.length
                        ? "Try a different search term."
                        : "No one has created a visitor account yet."
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </ProtectedRoute>
  );
}
