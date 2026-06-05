"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { submitNewsletterSignup } from "@/lib/firebase/contact";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

function FooterNavLink({ href, label, external }: FooterLink) {
  const className =
    "text-sm leading-7 text-stone-300 transition hover:text-ink";

  if (external) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

const exploreLinks: FooterLink[] = [
  { href: "/", label: "Homepage" },
  { href: "/directory", label: "Business directory" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/about", label: "About MKE Black" },
  { href: "/what-we-do", label: "What we do" },
  { href: "/who-we-are", label: "Who we are" },
  { href: "/news-articles", label: "News & articles" },
  { href: "/events", label: "Events" },
  { href: "/membership", label: "Solidarity Circle" },
  { href: "/contact", label: "Contact" }
];

function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await submitNewsletterSignup(email);
      setEmail("");
      setFeedback("Thanks for subscribing.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Unable to subscribe.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-panel/70 p-6">
      <p className="text-xs uppercase tracking-[0.26em] text-muted">
        Subscribe to our newsletter
      </p>
      <div className="mt-4 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          className="min-w-0 flex-1 rounded-xl border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder-stone-500 focus:border-accent/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {submitting ? "Joining…" : "Join"}
        </button>
      </div>
      {feedback ? <p className="mt-3 text-xs text-stone-400">{feedback}</p> : null}
    </form>
  );
}

export function SiteFooter() {
  const { user, hasAdminAccess } = useAuth();

  const businessLinks: FooterLink[] = [];

  if (!user) {
    businessLinks.push(
      { href: "/login", label: "Business owner login" },
      { href: "/login?next=/admin", label: "Admin login" }
    );
  } else if (hasAdminAccess) {
    businessLinks.push(
      { href: "/admin", label: "Admin workspace" },
      { href: "/admin/homepage", label: "Homepage editor" },
      { href: "/admin/businesses", label: "Business manager" },
      { href: "/admin/marketplace", label: "Marketplace" },
      { href: "/admin/members", label: "Solidarity Circle" },
      { href: "/admin/import", label: "Import spreadsheet" },
      { href: "/dashboard", label: "Owner dashboard" }
    );
  } else {
    businessLinks.push(
      { href: "/dashboard", label: "My listing" },
      { href: "/contact", label: "Submit a business" }
    );
  }

  return (
    <footer className="relative border-t border-line bg-charcoal/80">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">
              MKE Black
            </p>
            <h2 className="mt-4 max-w-sm font-display text-3xl font-black leading-tight text-ink">
              Milwaukee&apos;s Black business community, all in one place.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-8 text-stone-300">
              Browse the directory, catch community stories, find current member
              offers, and reach the right team without overloading the top
              navigation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://www.facebook.com/MKEBlackInc"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
              >
                Facebook
              </a>
              <a
                href="https://www.instagram.com/mkeblackinc/?hl=en"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
              >
                Instagram
              </a>
              <a
                href="https://x.com/MKEBlackInc"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
              >
                Twitter / X
              </a>
              <a
                href="https://www.linkedin.com/company/mkeblackinc"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-stone-300 transition hover:border-accent/50 hover:text-ink"
              >
                LinkedIn
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-muted">
              Explore
            </p>
            <nav className="mt-5 flex flex-col gap-2">
              {exploreLinks.map((link) => (
                <FooterNavLink key={link.href} {...link} />
              ))}
            </nav>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-muted">
              {hasAdminAccess ? "Admin" : "Owners & Admins"}
            </p>
            <nav className="mt-5 flex flex-col gap-2">
              {businessLinks.map((link) => (
                <FooterNavLink key={`${link.href}-${link.label}`} {...link} />
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-panel/70 p-6">
              <p className="text-xs uppercase tracking-[0.26em] text-muted">
                Contact
              </p>
              <p className="mt-4 text-sm leading-7 text-stone-300">
                Questions, directory corrections, partnerships, and new business
                submissions — all through one contact path.
              </p>
              <Link
                href="/contact"
                className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
              >
                Open contact form
              </Link>
              <Link
                href="/submission"
                className="ml-3 mt-6 inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
              >
                Check submission
              </Link>
              <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted">
                Milwaukee, Wisconsin
              </p>
            </div>

            <div className="rounded-2xl border border-success/25 bg-success/5 p-6">
              <p className="text-xs uppercase tracking-[0.26em] text-muted">
                Support the mission
              </p>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                Your donation directly funds the directory, events, and community
                programs that drive Black community wealth.
              </p>
              <Link
                href="/membership"
                className="mt-5 inline-flex rounded-full border border-success/50 bg-success/10 px-5 py-2.5 text-sm font-semibold text-success transition hover:bg-success/20 hover:text-white"
              >
                Donate
              </Link>
            </div>

            <NewsletterSignup />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted">
          <p className="uppercase tracking-[0.22em]">{new Date().getFullYear()} MKE Black</p>
          <p className="uppercase tracking-[0.22em]">Directory discovery, owner updates, and community connection.</p>
          <p>
            Powered by the{" "}
            <a
              href="https://readyaimgo.biz"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-stone-400 transition hover:text-ink"
            >
              ReadyAimGo
            </a>{" "}
            platform
          </p>
        </div>
      </div>
    </footer>
  );
}
