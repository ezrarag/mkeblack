"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useRevenueShareLedger } from "@/hooks/use-revenue-share-ledger";
import { markRevenueSharePaidOut } from "@/lib/firebase/revenue-share";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { RevenueShareLedgerEntry } from "@/lib/types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

function exportPendingCsv(entries: RevenueShareLedgerEntry[]) {
  const pending = entries.filter((entry) => entry.status === "pending_payout");
  const grouped = new Map<
    string,
    { businessName: string; owedCents: number; orderCount: number }
  >();

  for (const entry of pending) {
    const current = grouped.get(entry.businessId) ?? {
      businessName: entry.businessName,
      owedCents: 0,
      orderCount: 0
    };

    current.owedCents += entry.netToBusinessCents;
    current.orderCount += 1;
    grouped.set(entry.businessId, current);
  }

  const rows = [
    ["businessId", "businessName", "amountOwed", "orderCount"].join(","),
    ...Array.from(grouped.entries()).map(([businessId, value]) =>
      [
        businessId,
        `"${value.businessName.replace(/"/g, '""')}"`,
        (value.owedCents / 100).toFixed(2),
        String(value.orderCount)
      ].join(",")
    )
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "revenue-share-pending-payouts.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminRevenueSharePage() {
  const { entries, summary, loading, error } = useRevenueShareLedger();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleMarkPaidOut(entryId: string) {
    setBusyId(entryId);
    setFeedback(null);

    try {
      await markRevenueSharePaidOut(entryId);
      setFeedback("Ledger entry marked paid out.");
    } catch (markError) {
      setFeedback(formatFirebaseError(markError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Admin
          </p>
          <h1 className="mt-2 font-display text-4xl font-black text-ink">
            Revenue Share
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
            Track marketplace sales, RAG platform fees, and outstanding manual
            payouts to businesses.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: "Total sales", value: formatMoney(summary.totalSalesCents) },
            {
              label: "Platform fees",
              value: formatMoney(summary.totalPlatformFeesCents)
            },
            {
              label: "Pending payout",
              value: formatMoney(summary.totalPendingPayoutCents)
            }
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-line bg-panel/80 px-5 py-4"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-muted">
                {item.label}
              </p>
              <p className="mt-2 font-display text-3xl font-black text-ink">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportPendingCsv(entries)}
            className="rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
          >
            Export monthly payout CSV
          </button>
        </div>

        {feedback ? (
          <div className="mt-4 rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-200">
            {feedback}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl border border-line bg-panel/70"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6">
            <StatePanel title="Unable to load ledger" description={error} />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel/80">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] divide-y divide-line text-left text-sm">
                <thead className="bg-panelAlt/80">
                  <tr>
                    <th className="px-4 py-3 font-medium text-stone-100">Date</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Business</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Sale</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Fee</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Net</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Status</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/70">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-4 text-stone-300">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-stone-100">
                        {entry.businessName}
                      </td>
                      <td className="px-4 py-4 text-stone-300">
                        {formatMoney(entry.saleAmountCents)}
                      </td>
                      <td className="px-4 py-4 text-stone-300">
                        {formatMoney(entry.platformFeeCents)}
                      </td>
                      <td className="px-4 py-4 text-stone-300">
                        {formatMoney(entry.netToBusinessCents)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                            entry.status === "paid_out"
                              ? "border border-success/35 bg-success/10 text-success"
                              : "border border-amber-400/35 bg-amber-400/10 text-amber-200"
                          }`}
                        >
                          {entry.status === "paid_out" ? "Paid out" : "Pending payout"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {entry.status === "pending_payout" ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkPaidOut(entry.id)}
                            disabled={busyId === entry.id}
                            className="rounded-full border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
                          >
                            {busyId === entry.id ? "Saving..." : "Mark paid out"}
                          </button>
                        ) : (
                          <span className="text-xs text-stone-500">
                            {formatDate(entry.paidOutAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
