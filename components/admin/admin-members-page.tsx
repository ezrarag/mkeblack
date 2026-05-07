"use client";

import Link from "next/link";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useMembers } from "@/hooks/use-members";
import {
  updateMemberStatus,
  updateMemberNotes,
  linkMemberToUser,
  linkMemberToBusiness,
  updateMemberExpiry
} from "@/lib/firebase/members";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { SolidarityMember, SolidarityMemberStatus } from "@/lib/types";

const statusColors: Record<SolidarityMemberStatus, string> = {
  active: "border-success/40 bg-success/10 text-success",
  expired: "border-danger/40 bg-danger/10 text-rose-300",
  comp: "border-info/40 bg-info/10 text-blue-300",
  pending: "border-line bg-panelAlt text-muted"
};

function fmt(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function MemberRow({ member }: { member: SolidarityMember }) {
  const [status, setStatus] = useState<SolidarityMemberStatus>(member.status);
  const [notes, setNotes] = useState(member.notes);
  const [uid, setUid] = useState(member.uid ?? "");
  const [businessId, setBusinessId] = useState(member.businessId ?? "");
  const [expiry, setExpiry] = useState(
    member.expiresAt ? member.expiresAt.toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      await Promise.all([
        updateMemberStatus(member.id, status),
        updateMemberNotes(member.id, notes),
        linkMemberToUser(member.id, uid.trim() || null),
        linkMemberToBusiness(member.id, businessId.trim() || null),
        updateMemberExpiry(
          member.id,
          expiry ? new Date(expiry) : null
        )
      ]);
      setFeedback("Saved.");
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">{member.name || "(no name)"}</p>
          <p className="text-sm text-stone-400">{member.email}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="text-muted">Joined: {fmt(member.joinedAt)}</span>
            <span className="text-muted">Source: {member.paymentSource}</span>
            {member.paymentReference ? (
              <span className="text-muted">Ref: {member.paymentReference}</span>
            ) : null}
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${statusColors[status]}`}
        >
          {status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Status</p>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SolidarityMemberStatus)}
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="comp">Comp</option>
          </select>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Expiry date</p>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Linked UID</p>
          <input
            type="text"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="Firebase UID"
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder-stone-600 focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Linked business ID</p>
          <input
            type="text"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="Firestore business doc ID"
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder-stone-600 focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Notes</p>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes"
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder-stone-600 focus:border-accent/60 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-full border border-accent bg-accent px-5 py-2 text-xs font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {businessId.trim() ? (
          <Link
            href={`/admin/businesses/${businessId.trim()}`}
            className="text-xs text-accent hover:text-accentSoft"
          >
            View business →
          </Link>
        ) : null}
        {feedback ? (
          <p className="text-xs text-stone-400">{feedback}</p>
        ) : null}
      </div>
    </div>
  );
}

const statusFilters: Array<{ value: SolidarityMemberStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "comp", label: "Comp" },
  { value: "expired", label: "Expired" }
];

export function AdminMembersPage() {
  const { members, loading, error } = useMembers();
  const [filter, setFilter] = useState<SolidarityMemberStatus | "all">("all");
  const [search, setSearch] = useState("");

  const visible = members.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.paymentReference.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: members.length,
    active: members.filter((m) => m.status === "active").length,
    pending: members.filter((m) => m.status === "pending").length,
    comp: members.filter((m) => m.status === "comp").length,
    expired: members.filter((m) => m.status === "expired").length
  };

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                Admin
              </p>
              <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink">
                Solidarity Circle
              </h1>
              <p className="mt-2 text-sm text-stone-400">
                {counts.active} active · {counts.pending} pending · {counts.comp} comp · {counts.expired} expired
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
            >
              ← Admin home
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or reference…"
            className="flex-1 rounded-xl border border-line bg-panel/80 px-4 py-3 text-sm text-ink placeholder-stone-500 focus:border-accent/60 focus:outline-none min-w-0"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {statusFilters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filter === value
                  ? "bg-accent text-white"
                  : "border border-line text-stone-300 hover:border-accent/40 hover:text-ink"
              }`}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-32 animate-pulse rounded-xl border border-line bg-panel/70" />
              ))}
            </div>
          ) : error ? (
            <StatePanel title="Unable to load members" description={error} />
          ) : !visible.length ? (
            <StatePanel
              title="No members found"
              description={
                filter !== "all"
                  ? `No ${filter} members match your search.`
                  : "No Solidarity Circle members yet."
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>
      </section>
    </ProtectedRoute>
  );
}
