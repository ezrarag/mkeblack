"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useBenefitTypes } from "@/hooks/use-benefit-types";
import { useMembers } from "@/hooks/use-members";
import {
  deleteBenefitType,
  saveBenefitType,
  saveMemberAdminState
} from "@/lib/firebase/members";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BenefitType, SolidarityMember, SolidarityMemberStatus } from "@/lib/types";

const statusColors: Record<SolidarityMemberStatus, string> = {
  active: "border-success/40 bg-success/10 text-success",
  expired: "border-danger/40 bg-danger/10 text-rose-300",
  comp: "border-info/40 bg-info/10 text-blue-300",
  pending: "border-line bg-panelAlt text-muted",
  rejected: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  trash: "border-stone-500/40 bg-stone-500/10 text-stone-400"
};

function fmt(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function MemberRow({
  member,
  benefitTypes
}: {
  member: SolidarityMember;
  benefitTypes: BenefitType[];
}) {
  const [status, setStatus] = useState<SolidarityMemberStatus>(member.status);
  const [notes, setNotes] = useState(member.notes);
  const [uid, setUid] = useState(member.uid ?? "");
  const [businessId, setBusinessId] = useState(member.businessId ?? "");
  const [benefitIds, setBenefitIds] = useState(member.benefitIds);
  const [expiry, setExpiry] = useState(
    member.expiresAt ? member.expiresAt.toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function save(nextStatus = status) {
    setSaving(true);
    setFeedback(null);
    try {
      await saveMemberAdminState(member.id, {
        status: nextStatus,
        notes,
        uid: uid.trim() || null,
        businessId: businessId.trim() || null,
        expiresAt: expiry ? new Date(expiry) : null,
        benefitIds
      });
      setStatus(nextStatus);
      setFeedback("Saved.");
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleBenefit(benefitId: string) {
    setBenefitIds((current) =>
      current.includes(benefitId)
        ? current.filter((id) => id !== benefitId)
        : [...current, benefitId]
    );
  }

  return (
    <div id={`member-${member.id}`} className="rounded-xl border border-line bg-panel/80 p-5">
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
            <option value="rejected">Rejected</option>
            <option value="trash">Trash</option>
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

      {benefitTypes.length ? (
        <div className="mt-4 rounded-xl border border-line/60 bg-panelAlt/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
            Assigned benefits
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {benefitTypes.map((benefit) => (
              <label
                key={benefit.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                  benefitIds.includes(benefit.id)
                    ? "border-success/35 bg-success/10 text-stone-100"
                    : "border-line bg-panel/50 text-stone-300 hover:border-accent/35"
                }`}
              >
                <input
                  type="checkbox"
                  checked={benefitIds.includes(benefit.id)}
                  onChange={() => toggleBenefit(benefit.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold">{benefit.label}</span>
                  {benefit.description ? (
                    <span className="block text-xs leading-5 text-stone-400">
                      {benefit.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-full border border-accent bg-accent px-5 py-2 text-xs font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status !== "rejected" && status !== "trash" ? (
          <button
            type="button"
            onClick={() => void save("rejected")}
            disabled={saving}
            className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
          >
            Reject
          </button>
        ) : null}
        {status === "rejected" ? (
          <button
            type="button"
            onClick={() => void save("trash")}
            disabled={saving}
            className="rounded-full border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-medium text-rose-300 transition hover:bg-danger/20 disabled:opacity-50"
          >
            Move to trash
          </button>
        ) : null}
        {status === "trash" ? (
          <button
            type="button"
            onClick={() => void save("pending")}
            disabled={saving}
            className="rounded-full border border-line px-4 py-2 text-xs font-medium text-stone-300 transition hover:border-accent/40 hover:text-ink disabled:opacity-50"
          >
            Restore to pending
          </button>
        ) : null}
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
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
  { value: "trash", label: "Trash" }
];

type DuplicateAuditGroup = {
  key: string;
  label: string;
  members: SolidarityMember[];
};

function duplicateGroupsFor(
  members: SolidarityMember[],
  field: "email" | "businessId" | "paymentReference"
): DuplicateAuditGroup[] {
  const groups = new Map<string, SolidarityMember[]>();
  members.forEach((member) => {
    const raw = member[field]?.trim().toLowerCase();
    if (!raw) return;
    groups.set(raw, [...(groups.get(raw) ?? []), member]);
  });

  return Array.from(groups.entries())
    .filter(([, grouped]) => grouped.length > 1)
    .map(([key, grouped]) => ({
      key,
      label:
        field === "email"
          ? "Email"
          : field === "businessId"
            ? "Business ID"
            : "Payment reference",
      members: grouped
    }))
    .sort((a, b) => b.members.length - a.members.length);
}

function MemberAuditPanel({ members }: { members: SolidarityMember[] }) {
  const auditGroups = useMemo(() => {
    const activeRecords = members.filter((member) => member.status !== "trash");
    return [
      ...duplicateGroupsFor(activeRecords, "email"),
      ...duplicateGroupsFor(activeRecords, "businessId"),
      ...duplicateGroupsFor(activeRecords, "paymentReference")
    ].slice(0, 8);
  }, [members]);

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Duplicate audit
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-400">
            This flags member requests that share an email, linked business ID, or
            payment reference. Reject confirmed duplicates first, then move rejected
            records to trash so they stay recoverable.
          </p>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-stone-300">
          {auditGroups.length} group{auditGroups.length === 1 ? "" : "s"}
        </span>
      </div>

      {auditGroups.length ? (
        <div className="mt-4 grid gap-3">
          {auditGroups.map((group) => (
            <div
              key={`${group.label}-${group.key}`}
              className="rounded-xl border border-line bg-panelAlt/50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {group.label}: <span className="text-accent">{group.key}</span>
                </p>
                <span className="text-xs text-stone-400">
                  {group.members.length} records
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {group.members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      const element = document.getElementById(`member-${member.id}`);
                      element?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel/50 px-3 py-2 text-left text-xs transition hover:border-accent/35"
                  >
                    <span className="font-semibold text-ink">{member.name || "(no name)"}</span>
                    <span className="text-stone-400">{member.email || "no email"}</span>
                    <span className={`rounded-full border px-2 py-0.5 uppercase ${statusColors[member.status]}`}>
                      {member.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-panelAlt/40 p-4 text-sm text-stone-400">
          No duplicate-looking member requests found outside trash.
        </p>
      )}
    </div>
  );
}

function BenefitTypesPanel({
  benefitTypes,
  loading,
  error
}: {
  benefitTypes: BenefitType[];
  loading: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<Omit<BenefitType, "id">>({
    label: "",
    description: "",
    active: true,
    order: 0
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function edit(benefit: BenefitType) {
    setEditingId(benefit.id);
    setDraft({
      label: benefit.label,
      description: benefit.description,
      active: benefit.active,
      order: benefit.order
    });
    setFeedback(null);
  }

  function reset() {
    setEditingId(null);
    setDraft({ label: "", description: "", active: true, order: benefitTypes.length });
  }

  async function save() {
    if (!draft.label.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveBenefitType(editingId, draft);
      setFeedback(editingId ? "Benefit updated." : "Benefit created.");
      reset();
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(benefit: BenefitType) {
    if (!window.confirm(`Delete ${benefit.label}? Existing member assignments will remain as stored IDs until removed.`)) {
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await deleteBenefitType(benefit.id);
      setFeedback("Benefit deleted.");
      if (editingId === benefit.id) reset();
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-6 shadow-glow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Benefit types
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-400">
            Define the benefits admins can assign to Solidarity Circle members, such
            as T-shirts, member discounts, and exclusive events.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-stone-300 transition hover:border-accent/40 hover:text-ink"
        >
          New benefit
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_120px_auto]">
        <input
          type="text"
          value={draft.label}
          onChange={(event) =>
            setDraft((current) => ({ ...current, label: event.target.value }))
          }
          placeholder="Benefit label"
          className="rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder-stone-600 focus:border-accent/60 focus:outline-none"
        />
        <input
          type="text"
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value
            }))
          }
          placeholder="Short admin description"
          className="rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder-stone-600 focus:border-accent/60 focus:outline-none"
        />
        <input
          type="number"
          value={draft.order}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              order: Number(event.target.value) || 0
            }))
          }
          className="rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !draft.label.trim()}
          className="rounded-full border border-accent bg-accent px-5 py-2 text-xs font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {saving ? "Saving…" : editingId ? "Update" : "Create"}
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-stone-400">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={() =>
            setDraft((current) => ({ ...current, active: !current.active }))
          }
        />
        Active benefit
      </label>

      {feedback ? <p className="mt-3 text-xs text-stone-400">{feedback}</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl border border-line bg-panelAlt/60" />
        ) : benefitTypes.length ? (
          benefitTypes.map((benefit) => (
            <div
              key={benefit.id}
              className="rounded-xl border border-line bg-panelAlt/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{benefit.label}</p>
                  {benefit.description ? (
                    <p className="mt-1 text-xs leading-5 text-stone-400">
                      {benefit.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                    {benefit.active ? "Active" : "Inactive"} · Order {benefit.order}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => edit(benefit)}
                    className="rounded-full border border-line px-3 py-1 text-xs text-stone-300 transition hover:border-accent/40 hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(benefit)}
                    className="rounded-full border border-danger/40 px-3 py-1 text-xs text-rose-300 transition hover:bg-danger/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-panelAlt/40 p-4 text-sm text-stone-400">
            No benefit types yet.
          </p>
        )}
      </div>
    </div>
  );
}

export function AdminMembersPage() {
  const { members, loading, error } = useMembers();
  const {
    benefitTypes,
    loading: benefitsLoading,
    error: benefitsError
  } = useBenefitTypes();
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
    expired: members.filter((m) => m.status === "expired").length,
    rejected: members.filter((m) => m.status === "rejected").length,
    trash: members.filter((m) => m.status === "trash").length
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
                {counts.active} active · {counts.pending} pending · {counts.rejected} rejected · {counts.trash} trash
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

        <BenefitTypesPanel
          benefitTypes={benefitTypes}
          loading={benefitsLoading}
          error={benefitsError}
        />

        <MemberAuditPanel members={members} />

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
                <MemberRow
                  key={member.id}
                  member={member}
                  benefitTypes={benefitTypes.filter((benefit) => benefit.active)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </ProtectedRoute>
  );
}
