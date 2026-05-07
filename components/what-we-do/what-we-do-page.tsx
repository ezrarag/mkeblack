import Link from "next/link";

const pillars = [
  {
    number: "01",
    title: "Black Business Directory",
    description:
      "A comprehensive, searchable directory of Black-owned businesses throughout Milwaukee. We make it easy to discover, support, and connect with local entrepreneurs across every industry — from food and retail to professional services and more."
  },
  {
    number: "02",
    title: "Social Media Promotions",
    description:
      "We amplify Black-owned businesses and community stories across social channels, growing visibility and driving real customer connections. Our promotional efforts reach thousands of community members and allies who are actively looking to support."
  },
  {
    number: "03",
    title: "Facilitate Connections",
    description:
      "MKE Black bridges business owners, community leaders, investors, and potential customers. We create spaces — both digital and in-person — where meaningful introductions happen and lasting partnerships form."
  },
  {
    number: "04",
    title: "Black Cultural & Business Events",
    description:
      "Since summer 2020, we have organized and supported cultural and business events that celebrate Black excellence, build community, and generate economic opportunity. These events serve as a gathering point for Milwaukee's Black community and its allies."
  }
];

export function WhatWeDoPage() {
  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            What We Do
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Four pillars of community investment.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            MKE Black creates sustainable pathways to visibility, connection, and wealth
            for Milwaukee&apos;s Black community through four core initiatives.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {pillars.map((pillar) => (
            <div
              key={pillar.number}
              className="rounded-2xl border border-line bg-panel/80 p-8"
            >
              <p className="font-display text-4xl font-black text-accent/20">
                {pillar.number}
              </p>
              <h2 className="mt-4 font-display text-2xl font-bold text-ink">
                {pillar.title}
              </h2>
              <p className="mt-4 text-sm leading-8 text-stone-300">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
          <p className="font-display text-2xl font-bold text-ink">
            Want to get your business listed?
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Submit your Black-owned Milwaukee business and we&apos;ll add it to the directory.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-full border border-accent bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
          >
            Submit a business
          </Link>
        </div>
      </section>
    </main>
  );
}
