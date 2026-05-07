"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getFirebaseAuth,
  loadFirebaseAuthModule
} from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

const publicLinks: NavLink[] = [
  { href: "/directory", label: "Directory" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/about", label: "About" },
  { href: "/news-articles", label: "News" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" }
];

function HeaderLink({ href, label, external }: NavLink) {
  const className =
    "rounded-full border border-line px-4 py-2 text-sm font-medium text-ink/80 transition hover:border-accent/50 hover:bg-accent/10 hover:text-ink";
  if (external) return <a href={href} className={className}>{label}</a>;
  return <Link href={href} className={className}>{label}</Link>;
}

function getAvatarInitials(
  displayName: string | null | undefined,
  email: string | null | undefined
) {
  const source = displayName?.trim() || email?.trim() || "Account";
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "AC";
}

export function SiteHeader() {
  const { user, profile, isAdmin, isVisitor, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasAdminAccess = isAdmin || profile?.role === "admin";
  const avatarInitials = getAvatarInitials(user?.displayName, user?.email);

  const accountLinks: NavLink[] = hasAdminAccess
    ? [
        { href: "/admin", label: "Admin workspace" },
        { href: "/admin/homepage", label: "Homepage editor" },
        { href: "/admin/businesses", label: "Business manager" },
        { href: "/admin/marketplace", label: "Marketplace" },
        { href: "/admin/members", label: "Solidarity Circle" },
        { href: "/admin/claims", label: "Pending claims" },
        { href: "/admin/import", label: "Import spreadsheet" },
        { href: "/admin/team", label: "Team access" },
      ]
    : isVisitor
      ? [
          { href: "/visitor", label: "My favorites" },
          { href: "/visitor", label: "My account" },
        ]
      : [{ href: "/dashboard", label: "My listing" }];

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-charcoal/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-accent/30 ring-offset-1 ring-offset-charcoal">
            <Image
              src="/header-mark.avif"
              alt="MKE Black logo"
              fill
              priority
              sizes="40px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-display text-xl font-black tracking-tight text-ink transition group-hover:text-accent">
              MKE Black
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
              Milwaukee Black Business Directory
            </p>
          </div>
        </Link>

        <nav className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {publicLinks.map((link) => (
            <HeaderLink key={link.href} {...link} />
          ))}

          <a
            href="https://www.mkeblack.org/donate"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-success/50 bg-success/10 px-4 py-2 text-sm font-medium text-success transition hover:bg-success/20 hover:text-white"
          >
            Donate
          </a>

          {loading ? (
            <span className="rounded-full border border-line px-4 py-2 text-sm text-muted">…</span>
          ) : user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Open account menu"
                onClick={() => setMenuOpen((c) => !c)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold uppercase tracking-[0.15em] transition",
                  menuOpen
                    ? "border-accent bg-accent text-white"
                    : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
                )}
              >
                {avatarInitials}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-line bg-panel/98 p-3 shadow-glow backdrop-blur-xl">
                  <div className="rounded-xl border border-line/60 bg-canvas/60 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
                      {hasAdminAccess ? "Admin account" : isVisitor ? "MKE Black member" : "Business owner"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {user.displayName || user.email || "MKE Black account"}
                    </p>
                    {user.email && (
                      <p className="mt-0.5 text-xs text-stone-400">{user.email}</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5">
                    {accountLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-xl border border-line bg-panelAlt/60 px-4 py-2.5 text-sm text-stone-200 transition hover:border-accent/40 hover:bg-accent/10 hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    ))}

                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        const [authModule, auth] = await Promise.all([
                          loadFirebaseAuthModule(),
                          getFirebaseAuth()
                        ]);
                        if (auth) await authModule.signOut(auth);
                      }}
                      className="rounded-xl border border-accent/40 bg-accent px-4 py-2.5 text-left text-sm font-medium text-white transition hover:bg-accentSoft"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/join"
                className="rounded-full border border-success/50 bg-success/10 px-4 py-2 text-sm font-medium text-success transition hover:bg-success/20 hover:text-white"
              >
                Join
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
              >
                Business Login
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
