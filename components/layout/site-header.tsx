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
  { href: "https://www.mkeblack.org/contact", label: "Contact", external: true }
];

function HeaderLink({ href, label, external }: NavLink) {
  const className =
    "rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-accent/40 hover:bg-accent/10 hover:text-accentSoft";
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
  const { user, profile, isAdmin, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const hasAdminAccess = isAdmin || profile?.role === "admin";
  const avatarInitials = getAvatarInitials(user?.displayName, user?.email);

  const accountLinks: NavLink[] = hasAdminAccess
    ? [
        { href: "/admin", label: "Admin workspace" },
        { href: "/admin/homepage", label: "Homepage editor" },
        { href: "/admin/businesses", label: "Business manager" },
        { href: "/admin/import", label: "Import spreadsheet" },
        { href: "/admin/team", label: "Team access" },
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
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-4">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-accent/40 bg-accent/10">
            <Image
              src="/header-mark.avif"
              alt="MKE Black logo"
              fill
              priority
              sizes="44px"
              className="object-cover"
            />
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
          {publicLinks.map((link) => (
            <HeaderLink key={link.href} {...link} />
          ))}

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
                  "flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold uppercase tracking-[0.2em] transition",
                  menuOpen
                    ? "border-accent/55 bg-accent text-canvas"
                    : "border-accent/35 bg-accent/10 text-accentSoft hover:bg-accent/15"
                )}
              >
                {avatarInitials}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-3 w-72 rounded-[1.8rem] border border-line bg-panel/95 p-3 shadow-glow">
                  <div className="rounded-[1.4rem] border border-line/80 bg-canvas/45 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                      {hasAdminAccess ? "Admin account" : "Business owner"}
                    </p>
                    <p className="mt-2 font-medium text-stone-100">
                      {user.displayName || user.email || "MKE Black account"}
                    </p>
                    {user.email && (
                      <p className="mt-1 text-sm text-stone-400">{user.email}</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {accountLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-2xl border border-line bg-panelAlt/60 px-4 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:bg-accent/10 hover:text-accentSoft"
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
                      className="rounded-2xl border border-accent/35 bg-accent px-4 py-3 text-left text-sm text-canvas transition hover:bg-accentSoft"
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
                href="/login?next=/admin"
                className="rounded-full border border-line px-4 py-2 text-sm text-stone-300 transition hover:border-accent/40 hover:bg-accent/10 hover:text-accentSoft"
              >
                Admin
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-accent/35 bg-accent px-4 py-2 text-sm text-canvas transition hover:bg-accentSoft"
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
