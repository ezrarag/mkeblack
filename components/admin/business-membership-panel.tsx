"use client";

import { useState } from "react";
import { Business } from "@/lib/types";
import { setBusinessSolidarityMembership } from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";

type Props = {
  business: Business;
};

export function BusinessMembershipPanel({ business }: Props) {
  const [member, setMember] = useState(business.solidarityMember);
  const [since, setSince] = useState(
    business.solidarityMemberSince
      ? business.solidarityMemberSince.toISOString().slice(0, 10)
      : ""
  );
  const [expiry, setExpiry] = useState(
    business.solidarityMemberExpiry
      ? business.solidarityMemberExpiry.toISOString().slice(0, 10)
      : ""
  );
  const [source, setSource] = useState<"stripe" | "manual" | "comp">(
    business.solidarityMembershipSource
  );
  const [notes, setNotes] = useState(business.solidarityMembershipNotes);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      await setBusinessSolidarityMembership(business.id, {
        solidarityMember: member,
        solidarityMemberSince: since ? new Date(since) : null,
        solidarityMemberExpiry: expiry ? new Date(expiry) : null,
        solidarityMembershipSource: source,
        solidarityMembershipNotes: notes
      });
      setFeedbackTone("success");
      setFeedback("Membership updated.");
    } catch (err) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  const isExpired =
    business.solidarityMemberExpiry &&
    business.solidarityMemberExpiry < new Date();

  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
        Solidarity Circle membership
      </p>

      {business.solidarityMember ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-xs font-semibold text-success">
            {isExpired ? "Expired member" : "Active member"}
          </span>
        </div>
      ) : (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-panelAlt/70 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
          <span className="text-xs text-muted">Not a member</span>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <input
            id="solidarity-toggle"
            type="checkbox"
            checked={member}
            onChange={(e) => setMember(e.target.checked)}
            className="h-4 w-4 rounded accent-accent"
          />
          <label
            htmlFor="solidarity-toggle"
            className="text-sm font-medium text-stone-200"
          >
            Solidarity Circle member
          </label>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Membership source
          </p>
          <select
            value={source}
            onChange={(e) =>
              setSource(e.target.value as "stripe" | "manual" | "comp")
            }
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          >
            <option value="stripe">Stripe payment</option>
            <option value="manual">Paid externally</option>
            <option value="comp">Comped by MKE Black</option>
          </select>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Member since
          </p>
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Membership expiry
          </p>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Internal notes
        </p>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Board comp through 2026, invoice paid offline, sponsor grant..."
          className="mt-1.5 w-full rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder:text-stone-500 focus:border-accent/60 focus:outline-none"
        />
      </div>

      {feedback ? (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            feedbackTone === "success"
              ? "border-success/35 bg-success/10 text-stone-100"
              : "border-danger/35 bg-danger/10 text-stone-100"
          }`}
        >
          {feedback}
        </p>
      ) : null}

      <div className="mt-5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-full border border-accent bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save membership"}
        </button>
      </div>

      <p className="mt-4 text-xs leading-6 text-stone-500">
        Mark as member to show the Solidarity Circle badge on the directory card and
        business profile. Use comped source when MKE Black furnishes membership
        without Stripe payment.
      </p>
    </div>
  );
}
