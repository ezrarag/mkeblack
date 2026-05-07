import Link from "next/link";

const principles = [
  {
    swahili: "Umoja",
    english: "Unity",
    description:
      "Strive for and maintain unity in the family, community, nation, and race."
  },
  {
    swahili: "Kujichagulia",
    english: "Self-Determination",
    description:
      "Define ourselves, name ourselves, create for ourselves, and speak for ourselves."
  },
  {
    swahili: "Ujima",
    english: "Collective Work & Responsibility",
    description:
      "Build and maintain our community together and make our community's problems our problems to solve together."
  },
  {
    swahili: "Ujamaa",
    english: "Cooperative Economics",
    description:
      "Build and maintain our own stores, shops, and other businesses, and profit from them together."
  },
  {
    swahili: "Nia",
    english: "Purpose",
    description:
      "Make our collective vocation the building and developing of our community in order to restore our people to their traditional greatness."
  },
  {
    swahili: "Kuumba",
    english: "Creativity",
    description:
      "Always do as much as we can, in the way we can, to leave our community more beautiful than we inherited it."
  },
  {
    swahili: "Imani",
    english: "Faith",
    description:
      "Believe with all our heart in our people, our parents, our teachers, our leaders, and the righteousness of our struggle."
  }
];

export function AboutPage() {
  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            About MKE Black
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Building community wealth in Milwaukee.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Founded in 2019 by Paul Wellington and Rick Banks, MKE Black is a nonprofit
            committed to amplifying the Milwaukee Black community through intentional
            investment and global connection.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-panel/80 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
              Our Mission
            </p>
            <p className="mt-5 text-lg leading-8 text-stone-200">
              To amplify the Milwaukee Black Community by facilitating intentional investment
              of resources and building global connections.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-panel/80 p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
              Our Vision
            </p>
            <p className="mt-5 text-lg leading-8 text-stone-200">
              To create boundless opportunities driving Black community wealth.
            </p>
          </div>
        </div>

        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Seven Guiding Principles
          </p>
          <h2 className="mt-4 font-display text-3xl font-black leading-tight text-ink">
            Nguzo Saba
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-stone-400">
            MKE Black is guided by the Nguzo Saba — seven principles rooted in African
            communal values that shape how we build and sustain community.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle, index) => (
              <div
                key={principle.swahili}
                className="rounded-2xl border border-line bg-panel/80 p-6"
              >
                <p className="font-display text-3xl font-black text-accent/20">
                  {index + 1}
                </p>
                <p className="mt-3 font-display text-xl font-bold text-ink">
                  {principle.swahili}
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-accent">
                  {principle.english}
                </p>
                <p className="mt-3 text-sm leading-7 text-stone-400">
                  {principle.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
          <p className="font-display text-2xl font-bold text-ink">
            Ready to connect with the community?
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Browse the directory, discover local businesses, and become part of the movement.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/directory"
              className="rounded-full border border-accent bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              Explore the directory
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-line px-6 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
