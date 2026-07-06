"use client";

import { StatePanel } from "@/components/ui/state-panel";
import { useRevenueShareLedger } from "@/hooks/use-revenue-share-ledger";

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

type RevenueSharePanelProps = {
  businessId: string;
};

export function RevenueSharePanel({ businessId }: RevenueSharePanelProps) {
  const { entries, summary, loading, error } = useRevenueShareLedger({
    businessId
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-line bg-panel/60"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <StatePanel title="Unable to load revenue share" description={error} />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-panel/80 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          Revenue Share
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink">
          Marketplace sales and payout history
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
          This view shows marketplace sales processed on MKE Black, the current
          RAG platform fee, and the running net amount owed back to your
          business while Phase A manual payouts are in place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Sales this month",
            value: formatMoney(summary.monthSalesCents)
          },
          {
            label: "Platform fee this month",
            value: formatMoney(summary.monthPlatformFeesCents)
          },
          {
            label: "Net to your business",
            value: formatMoney(summary.monthNetToBusinessCents)
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

      <div className="rounded-2xl border border-line bg-panel/80 p-6">
        <p className="text-sm font-semibold text-stone-100">
          What the platform fee covers
        </p>
        <p className="mt-2 text-sm leading-7 text-stone-300">
          Stripe processing setup, checkout infrastructure, marketplace hosting,
          support, reporting, and manual payout reconciliation until direct
          Stripe Connect business payouts are introduced in a later phase.
        </p>
      </div>

      {entries.length ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel/80">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] divide-y divide-line text-left text-sm">
              <thead className="bg-panelAlt/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-stone-100">Date</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Sale</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Fee</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Net</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel/70">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-4 text-stone-300">
                      {formatDate(entry.createdAt)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <StatePanel
          title="No revenue share activity yet"
          description="Native marketplace checkout sales will appear here after the first paid order."
        />
      )}
    </div>
  );
}
