import Link from "next/link";

export function EventsPage() {
  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Events
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Black cultural &amp; business events.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Since summer 2020, MKE Black has organized and supported events that celebrate
            Black excellence, build community, and generate economic opportunity.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-12 text-center">
          <p className="font-display text-2xl font-bold text-ink">
            No events at the moment.
          </p>
          <p className="mt-3 max-w-md mx-auto text-sm leading-7 text-stone-400">
            Check back soon — we regularly host community gatherings, business mixers,
            and cultural celebrations throughout Milwaukee.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="https://www.facebook.com/MKEBlack"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-5 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
            >
              Follow on Facebook
            </a>
            <a
              href="https://www.instagram.com/mkeblack"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-5 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
            >
              Follow on Instagram
            </a>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
          <p className="font-display text-xl font-bold text-ink">
            Want to partner on an event?
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Reach out and let&apos;s talk about how we can create something meaningful together.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-full border border-accent bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </main>
  );
}
