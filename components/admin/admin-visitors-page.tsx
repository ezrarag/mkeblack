"use client";

import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useVisitors, VisitorRecord } from "@/hooks/use-visitors";

function fmtDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
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
  const providerLabel = visitor.authProviderIds.length
    ? visitor.authProviderIds
        .map((provider) => {
          if (provider === "password") return "Email/password";
          if (provider === "google.com") return "Google";
          return provider;
        })
        .join(", ")
    : "Unknown";

  return (
    <div className="rounded-xl border border-line bg-panel/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-stone-100">
              {visitor.displayName || "(no name)"}
            </p>
            <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-stone-300">
              {visitor.role}
            </span>
            {visitor.disabled ? (
              <span className="rounded-full border border-danger/35 bg-danger/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-rose-300">
                Disabled
              </span>
            ) : null}
          </div>
          <p className="truncate text-sm text-stone-400">{visitor.email}</p>
          <p className="mt-1 truncate text-xs font-mono text-stone-600">{visitor.uid}</p>
        </div>
        <span className="shrink-0 text-xs text-stone-500">
          Last sign-in {fmtDate(visitor.authLastSignInAt ?? visitor.lastLoginAt)}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-panelAlt/60 px-3 py-2">
          <p className="uppercase tracking-[0.16em] text-muted">Auth providers</p>
          <p className="mt-1 text-stone-200">{providerLabel}</p>
        </div>
        <div className="rounded-xl border border-line bg-panelAlt/60 px-3 py-2">
          <p className="uppercase tracking-[0.16em] text-muted">Last method</p>
          <p className="mt-1 text-stone-200">{visitor.lastLoginMethod ?? "Unknown"}</p>
        </div>
        <div className="rounded-xl border border-line bg-panelAlt/60 px-3 py-2">
          <p className="uppercase tracking-[0.16em] text-muted">Selected path</p>
          <p className="mt-1 text-stone-200">{visitor.lastLoginIntent ?? "Not tracked yet"}</p>
        </div>
        <div className="rounded-xl border border-line bg-panelAlt/60 px-3 py-2">
          <p className="uppercase tracking-[0.16em] text-muted">Reset request</p>
          <p className="mt-1 text-stone-200">{fmtDate(visitor.passwordResetRequestedAt)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
          Joined {fmtDate(visitor.createdAt)}
        </span>
        {visitor.businessId ? (
          <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
            Business linked
          </span>
        ) : null}
        {visitor.neighborhood ? (
          <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
            {visitor.neighborhood}
          </span>
        ) : null}
        {visitor.referralSource ? (
          <span className="rounded-full border border-line bg-panelAlt/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-stone-300">
            via {visitor.referralSource}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AdminVisitorsPage() {
  const { visitors, loading, error } = useVisitors();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | VisitorRecord["role"]>("all");

  const stats = useMemo(() => {
    const total = visitors.length;
    const visitorsOnly = visitors.filter((v) => v.role === "visitor").length;
    const businessUsers = visitors.filter((v) => v.role === "business").length;
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
    const roles = tallyOf(visitors.map((v) => v.role));
    const loginMethods = tallyOf(visitors.map((v) => v.lastLoginMethod));
    const authProviders = tallyOf(visitors.flatMap((v) => v.authProviderIds));
    const passwordResetRequests = visitors.filter((v) => v.passwordResetRequestedAt).length;

    return {
      total,
      visitorsOnly,
      businessUsers,
      optedIn,
      months,
      maxMonthly,
      neighborhoods,
      referralSources,
      interests,
      roles,
      loginMethods,
      authProviders,
      passwordResetRequests
    };
  }, [visitors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visitors.filter(
      (v) =>
        (roleFilter === "all" || v.role === roleFilter) &&
        (!q ||
          v.email.toLowerCase().includes(q) ||
          (v.displayName ?? "").toLowerCase().includes(q) ||
          (v.neighborhood ?? "").toLowerCase().includes(q) ||
          v.role.toLowerCase().includes(q) ||
          (v.lastLoginMethod ?? "").toLowerCase().includes(q) ||
          v.authProviderIds.join(" ").toLowerCase().includes(q))
    );
  }, [visitors, search, roleFilter]);

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accentSoft">
          Admin
        </p>
        <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink sm:text-5xl">
          Signed-in accounts
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300">
          See visitor, business, and admin profiles alongside Firebase Auth
          provider data, selected login paths, last sign-in timestamps, and
          password-reset requests.
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
                  Total accounts
                </p>
                <p className="mt-2 font-display text-3xl font-black text-ink">
                  {stats.total}
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Visitors / businesses
                </p>
                <p className="mt-2 font-display text-3xl font-black text-ink">
                  {stats.visitorsOnly} / {stats.businessUsers}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  visitor accounts / business accounts
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">
                  Password reset requests
                </p>
                <p className="mt-2 font-display text-3xl font-black text-ink">
                  {stats.passwordResetRequests}
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
                title="Account roles"
                tallies={stats.roles}
                total={stats.total}
                emptyHint="No account roles found."
              />
              <BreakdownCard
                title="Login methods"
                tallies={stats.loginMethods}
                total={stats.loginMethods.reduce((sum, t) => sum + t.count, 0)}
                emptyHint="No tracked login methods yet."
              />
              <BreakdownCard
                title="Auth providers"
                tallies={stats.authProviders}
                total={stats.authProviders.reduce((sum, t) => sum + t.count, 0)}
                emptyHint="No Auth provider metadata available."
              />
            </div>

            {/* ── List ── */}
            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">
                  All accounts ({filtered.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                    className="rounded-xl border border-line bg-panelAlt/70 px-4 py-2.5 text-sm text-ink"
                  >
                    <option value="all">All roles</option>
                    <option value="visitor">Visitors</option>
                    <option value="business">Businesses</option>
                    <option value="admin">Admins</option>
                    <option value="unknown">Unknown</option>
                  </select>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, role, provider…"
                    className="w-full max-w-xs rounded-xl border border-line bg-panelAlt/70 px-4 py-2.5 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
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
                        : "No accounts found yet."
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
