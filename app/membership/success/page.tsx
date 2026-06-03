import Link from "next/link";

export default function MembershipSuccessPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-success/35 bg-success/10 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-success">
          Checkout complete
        </p>
        <h1 className="mt-4 font-display text-4xl font-black text-ink">
          Thanks for supporting MKE Black.
        </h1>
        <p className="mt-4 text-sm leading-7 text-stone-300">
          Stripe has received your checkout. If this was a Solidarity Circle
          membership, your member record will activate as soon as the Stripe
          webhook confirms payment.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/directory"
            className="rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
          >
            Browse the directory
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-line px-5 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
          >
            Contact MKE Black
          </Link>
        </div>
      </div>
    </main>
  );
}
