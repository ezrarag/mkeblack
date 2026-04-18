"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Directory" },
  { href: "/dashboard", label: "Dashboard" }
];

export function SiteHeader() {
  const { user, isAdmin, loading } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-semibold uppercase tracking-[0.32em] text-accent">
            MB
          </div>
          <div>
            <p className="font-display text-2xl font-semibold tracking-wide text-ink transition group-hover:text-accentSoft">
              MKE Black
            </p>
            <p className="text-xs uppercase tracking-[0.26em] text-muted">
              Milwaukee Black Business Directory
            </p>
          </div>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-accent/40 hover:bg-accent/10 hover:text-accentSoft"
            >
              {link.label}
            </Link>
          ))}

          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm text-accentSoft transition hover:bg-accent/15"
            >
              Admin
            </Link>
          ) : null}

          {loading ? (
            <span className="rounded-full border border-line px-4 py-2 text-sm text-muted">
              Checking session...
            </span>
          ) : user ? (
            <button
              type="button"
              onClick={() => {
                const auth = getFirebaseAuth();

                if (auth) {
                  signOut(auth);
                }
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition",
                "border border-accent/35 bg-accent text-canvas hover:bg-accentSoft"
              )}
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-accent/35 bg-accent px-4 py-2 text-sm text-canvas transition hover:bg-accentSoft"
            >
              Business Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
