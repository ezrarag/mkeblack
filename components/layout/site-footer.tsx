"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

function FooterNavLink({ href, label, external }: FooterLink) {
  const className =
    "text-sm leading-7 text-stone-300 transition hover:text-accentSoft";

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
  { href: "/#stories", label: "Featured stories" },
  { href: "/#membership", label: "Membership" },
  { href: "/#discounts", label: "Member discounts" }
];

export function SiteFooter() {
  const { user, hasAdminAccess } = useAuth();

  // Build owner/admin links based on auth state
  const businessLinks: FooterLink[] = [];

  if (!user) {
    // Logged out — show login entry points with ?next= so they land in the right place
    businessLinks.push(
      { href: "/login", label: "Business owner login" },
      { href: "/login?next=/admin", label: "Admin login" }
    );
  } else if (hasAdminAccess) {
    // Logged in as admin — show all admin routes
    businessLinks.push(
      { href: "/admin", label: "Admin workspace" },
      { href: "/admin/homepage", label: "Homepage editor" },
      { href: "/admin/businesses", label: "Business manager" },
      { href: "/admin/import", label: "Import spreadsheet" },
      { href: "/dashboard", label: "Owner dashboard" }
    );
  } else {
    // Logged in as business owner
    businessLinks.push(
      { href: "/dashboard", label: "My listing" },
      {
        href: "https://www.mkeblack.org/contact",
        label: "Submit a business",
        external: true
      }
    );
  }

  return (
    <footer className="relative border-t border-line bg-panel/55">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-accentSoft">
              MKE Black
            </p>
            <h2 className="mt-4 max-w-sm font-display text-4xl leading-none text-ink">
              Milwaukee&apos;s Black business community, all in one place.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-8 text-stone-300">
              Browse the directory, catch community stories, find current member
              offers, and reach the right team without overloading the top
              navigation.
            </p>
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

          <div className="rounded-[2rem] border border-line bg-panelAlt/70 p-6">
            <p className="text-xs uppercase tracking-[0.26em] text-muted">
              Contact
            </p>
            <p className="mt-4 text-sm leading-7 text-stone-300">
              Questions, directory corrections, partnerships, and new business
              submissions should all funnel through one contact path.
            </p>
            <a
              href="https://www.mkeblack.org/contact"
              className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
            >
              Open contact form
            </a>
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted">
              Milwaukee, Wisconsin
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line/80 pt-6 text-xs uppercase tracking-[0.24em] text-muted">
          <p>{new Date().getFullYear()} MKE Black</p>
          <p>Directory discovery, owner updates, and community connection.</p>
        </div>
      </div>
    </footer>
  );
}
