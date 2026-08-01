"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { StatePanel } from "@/components/ui/state-panel";

type FinanceData = {
  range: string;
  generatedAt: string;
  summary: {
    grossCents: number;
    refundedCents: number;
    stripeFeesCents: number;
    platformFeesCents: number;
    netCents: number;
    availableCents: number;
    pendingCents: number;
    activeSubscriptions: number;
    monthlyRecurringCents: number;
    failedPayments: number;
    disputes: number;
  };
  transactions: Array<{
    id: string;
    createdAt: string | null;
    amountCents: number;
    refundedCents: number;
    currency: string;
    status: string;
    disputed: boolean;
    customerEmail: string;
    description: string;
    kind: string;
    stripeFeeCents: number;
    platformFeeCents: number;
  }>;
  subscriptions: Array<{
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    productName: string;
    amountCents: number;
    interval: string;
  }>;
  payouts: Array<{
    id: string;
    amountCents: number;
    status: string;
    arrivalDate: string | null;
    createdAt: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    description: string;
    active: boolean;
    prices: Array<{
      id: string;
      amountCents: number;
      currency: string;
      recurring: string | null;
    }>;
  }>;
  alerts: Array<{ id: string; severity: string; message: string }>;
};

type Tab = "overview" | "memberships" | "transactions" | "payouts" | "products";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
    : "—";
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-black text-ink">{value}</p>
      {note ? <p className="mt-2 text-xs text-stone-400">{note}</p> : null}
    </div>
  );
}

export function AdminFinancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("30d");
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/finance?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load financial information.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load financial information.");
    } finally {
      setLoading(false);
    }
  }, [range, user]);

  useEffect(() => void load(), [load]);

  async function action(payload: Record<string, unknown>, confirmation?: string) {
    if (!user || (confirmation && !window.confirm(confirmation))) return false;
    setBusy(String(payload.resourceId ?? payload.action));
    setFeedback("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Action failed.");
      setFeedback("Financial record updated successfully.");
      await load();
      return true;
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : "Action failed.");
      return false;
    } finally {
      setBusy("");
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">Admin · Financials</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-black text-ink">MKE Black financial dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
                Connected-account revenue, memberships, balances, payouts, and MKE-owned products.
                Gross, Stripe fees, platform fees, refunds, and net proceeds are shown separately.
              </p>
            </div>
            <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-full border border-line bg-panelAlt px-4 py-2 text-sm text-ink">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="365d">Last year</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["overview", "memberships", "transactions", "payouts", "products"] as Tab[]).map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`rounded-full border px-4 py-2 text-sm capitalize ${tab === item ? "border-accent bg-accent text-white" : "border-line text-stone-300"}`}>
              {item}
            </button>
          ))}
        </div>

        {feedback ? <div className="mt-4 rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-200">{feedback}</div> : null}
        {loading ? <div className="mt-6 h-52 animate-pulse rounded-2xl border border-line bg-panel/70" /> : null}
        {!loading && error ? <div className="mt-6"><StatePanel title="Unable to load financials" description={error} /></div> : null}
        {!loading && data ? (
          <>
            {tab === "overview" ? <Overview data={data} /> : null}
            {tab === "memberships" ? <Memberships data={data} busy={busy} action={action} /> : null}
            {tab === "transactions" ? <Transactions data={data} busy={busy} action={action} /> : null}
            {tab === "payouts" ? <Payouts data={data} /> : null}
            {tab === "products" ? <Products data={data} busy={busy} action={action} /> : null}
          </>
        ) : null}
      </section>
    </ProtectedRoute>
  );
}

function Overview({ data }: { data: FinanceData }) {
  const s = data.summary;
  return (
    <div className="mt-6 space-y-6">
      {data.alerts.length ? (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-5">
          <p className="font-semibold text-amber-200">Needs attention</p>
          <ul className="mt-2 space-y-1 text-sm text-stone-200">{data.alerts.map((alert) => <li key={alert.id}>• {alert.message}</li>)}</ul>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Gross revenue" value={money(s.grossCents)} />
        <Card label="Net proceeds" value={money(s.netCents)} note="After refunds, Stripe fees, and platform fees" />
        <Card label="Available balance" value={money(s.availableCents)} />
        <Card label="Pending balance" value={money(s.pendingCents)} />
        <Card label="Active memberships" value={String(s.activeSubscriptions)} />
        <Card label="Monthly recurring" value={money(s.monthlyRecurringCents)} />
        <Card label="Refunded" value={money(s.refundedCents)} />
        <Card label="Fees" value={money(s.stripeFeesCents + s.platformFeesCents)} note={`Stripe ${money(s.stripeFeesCents)} · Platform ${money(s.platformFeesCents)}`} />
      </div>
    </div>
  );
}

function Memberships({ data, busy, action }: { data: FinanceData; busy: string; action: (payload: Record<string, unknown>, confirmation?: string) => Promise<boolean> }) {
  return (
    <Table headers={["Plan", "Amount", "Status", "Renews / ends", "Action"]}>
      {data.subscriptions.map((subscription) => (
        <tr key={subscription.id} className="border-t border-line">
          <td className="px-4 py-4 text-ink">{subscription.productName}</td>
          <td className="px-4 py-4 text-stone-300">{money(subscription.amountCents)}{subscription.interval ? ` / ${subscription.interval}` : ""}</td>
          <td className="px-4 py-4 text-stone-300">{subscription.cancelAtPeriodEnd ? "Cancels at period end" : subscription.status.replace("_", " ")}</td>
          <td className="px-4 py-4 text-stone-300">{date(subscription.currentPeriodEnd)}</td>
          <td className="px-4 py-4">{["active", "trialing"].includes(subscription.status) && !subscription.cancelAtPeriodEnd ? <button disabled={busy === subscription.id} onClick={() => void action({ action: "cancel_subscription_at_period_end", resourceId: subscription.id }, "Cancel this membership at the end of its current paid period?")} className="rounded-full border border-danger/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-50">Cancel at period end</button> : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

function Transactions({ data, busy, action }: { data: FinanceData; busy: string; action: (payload: Record<string, unknown>, confirmation?: string) => Promise<boolean> }) {
  return (
    <Table headers={["Date", "Type", "Customer", "Gross", "Net", "Status", "Action"]}>
      {data.transactions.map((payment) => {
        const net = payment.amountCents - payment.refundedCents - payment.stripeFeeCents - payment.platformFeeCents;
        return <tr key={payment.id} className="border-t border-line">
          <td className="px-4 py-4 text-stone-300">{date(payment.createdAt)}</td>
          <td className="px-4 py-4 text-ink">{payment.kind.replace("_", " ")}</td>
          <td className="px-4 py-4 text-stone-300">{payment.customerEmail || "—"}</td>
          <td className="px-4 py-4 text-stone-300">{money(payment.amountCents, payment.currency.toUpperCase())}</td>
          <td className="px-4 py-4 text-stone-300">{money(net, payment.currency.toUpperCase())}</td>
          <td className="px-4 py-4 text-stone-300">{payment.refundedCents ? "refunded" : payment.disputed ? "disputed" : payment.status}</td>
          <td className="px-4 py-4">{payment.status === "succeeded" && payment.refundedCents === 0 && !payment.disputed ? <button disabled={busy === payment.id} onClick={() => void action({ action: "refund_payment", resourceId: payment.id }, `Issue a full ${money(payment.amountCents)} refund? This cannot be undone.`)} className="rounded-full border border-danger/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-50">Refund</button> : "—"}</td>
        </tr>;
      })}
    </Table>
  );
}

function Payouts({ data }: { data: FinanceData }) {
  return <Table headers={["Created", "Amount", "Status", "Expected arrival"]}>{data.payouts.map((payout) => <tr key={payout.id} className="border-t border-line"><td className="px-4 py-4 text-stone-300">{date(payout.createdAt)}</td><td className="px-4 py-4 text-ink">{money(payout.amountCents)}</td><td className="px-4 py-4 text-stone-300">{payout.status}</td><td className="px-4 py-4 text-stone-300">{date(payout.arrivalDate)}</td></tr>)}</Table>;
}

function Products({ data, busy, action }: { data: FinanceData; busy: string; action: (payload: Record<string, unknown>, confirmation?: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const success = await action({ action: "create_product", name, description, amountCents: Math.round(Number(amount) * 100), recurring: recurring || null });
    if (success) { setName(""); setDescription(""); setAmount(""); setRecurring(""); }
  }
  return <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
    <form onSubmit={submit} className="rounded-2xl border border-line bg-panel/80 p-5">
      <h2 className="font-display text-2xl font-bold text-ink">Add MKE product</h2>
      <p className="mt-2 text-xs leading-5 text-stone-400">For MKE-owned memberships, sponsorships, tickets, or offerings—not marketplace seller inventory.</p>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" className="mt-4 w-full rounded-xl border border-line bg-panelAlt px-4 py-3 text-sm text-ink" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="mt-3 w-full rounded-xl border border-line bg-panelAlt px-4 py-3 text-sm text-ink" />
      <input required type="number" min="0.50" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Price in dollars" className="mt-3 w-full rounded-xl border border-line bg-panelAlt px-4 py-3 text-sm text-ink" />
      <select value={recurring} onChange={(e) => setRecurring(e.target.value)} className="mt-3 w-full rounded-xl border border-line bg-panelAlt px-4 py-3 text-sm text-ink"><option value="">One time</option><option value="month">Monthly</option><option value="year">Yearly</option></select>
      <button disabled={busy === "create_product"} className="mt-4 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Create product and price</button>
    </form>
    <div className="space-y-3">{data.products.map((product) => <div key={product.id} className="rounded-2xl border border-line bg-panel/80 p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-ink">{product.name}</p><p className="mt-1 text-sm text-stone-400">{product.description}</p><p className="mt-2 text-xs text-stone-300">{product.prices.map((price) => `${money(price.amountCents, price.currency.toUpperCase())}${price.recurring ? ` / ${price.recurring}` : ""}`).join(" · ") || "No active price"}</p></div>{product.active ? <button disabled={busy === product.id} onClick={() => void action({ action: "archive_product", resourceId: product.id }, `Archive ${product.name}? Existing subscriptions will not be canceled.`)} className="rounded-full border border-line px-3 py-2 text-xs text-stone-300 disabled:opacity-50">Archive</button> : null}</div></div>)}</div>
  </div>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-panel/80">{hasRows ? <table className="min-w-[900px] w-full text-left text-sm"><thead className="bg-panelAlt/80"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium text-stone-100">{header}</th>)}</tr></thead><tbody>{children}</tbody></table> : <p className="p-8 text-center text-sm text-stone-400">No activity to show yet.</p>}</div>;
}
