"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  SetupGuideDrawer,
  SetupGuideTrigger
} from "@/components/setup/setup-guide";
import { NotificationBell } from "@/components/notifications/notification-bell";
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

const primaryLinks: NavLink[] = [
  { href: "/directory", label: "Directory" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/events", label: "Events" }
];

const exploreLinks: NavLink[] = [
  { href: "/about", label: "About" },
  { href: "/what-we-do", label: "What we do" },
  { href: "/who-we-are", label: "Who we are" },
  { href: "/news-articles", label: "News" },
  { href: "/groups", label: "Groups" },
  { href: "/contact", label: "Contact" }
];

const supportLinks: NavLink[] = [
  { href: "/membership#join", label: "Join Solidarity Circle" },
  { href: "/membership#donate", label: "Make a donation" },
  { href: "/membership#benefits", label: "Member benefits" }
];

function HeaderLink({ href, label, external }: NavLink) {
  const className =
    "rounded-full border border-line px-4 py-2 text-sm font-medium text-ink/80 transition hover:border-accent/50 hover:bg-accent/10 hover:text-ink";
  if (external) return <a href={href} className={className}>{label}</a>;
  return <Link href={href} className={className}>{label}</Link>;
}

function DropdownLink({
  href,
  label,
  external,
  onSelect
}: NavLink & { onSelect: () => void }) {
  const className =
    "rounded-xl border border-line bg-canvas/70 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/45 hover:bg-panelAlt/90 hover:text-accent";

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onSelect}
        className={className}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onSelect} className={className}>
      {label}
    </Link>
  );
}

function HeaderDropdown({
  label,
  open,
  onToggle,
  links,
  align = "right",
  className = ""
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  links: NavLink[];
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          "rounded-full border px-4 py-2 text-sm font-medium transition",
          open
            ? "border-accent/60 bg-accent/10 text-ink"
            : "border-line text-ink/80 hover:border-accent/50 hover:bg-accent/10 hover:text-ink"
        )}
      >
        {label}
        <span className="ml-1 text-xs text-muted">▾</span>
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-full z-[60] mt-3 w-64 rounded-2xl border border-line bg-canvas/95 p-3 shadow-glow backdrop-blur-xl",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="flex flex-col gap-1.5">
            {links.map((link) => (
              <DropdownLink
                key={`${label}-${link.href}-${link.label}`}
                {...link}
                onSelect={onToggle}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const {
    user,
    hasAdminAccess,
    hasBusinessAccess,
    isVisitor,
    loading
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [guestAccountOpen, setGuestAccountOpen] = useState(false);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const avatarInitials = getAvatarInitials(user?.displayName, user?.email);

  const accountLinks: NavLink[] = [];

  if (hasAdminAccess) {
    accountLinks.push(
      { href: "/admin", label: "Admin workspace" },
      { href: "/admin/homepage", label: "Homepage editor" },
      { href: "/admin/articles", label: "Articles" },
      { href: "/admin/businesses", label: "Business manager" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/marketplace", label: "Marketplace" },
      { href: "/admin/members", label: "Solidarity Circle" },
      { href: "/admin/visitors", label: "Visitors" },
      { href: "/admin/claims", label: "Pending claims" },
      { href: "/admin/import", label: "Import spreadsheet" },
      { href: "/admin/team", label: "Team access" }
    );
  }

  if (hasBusinessAccess) {
    accountLinks.push({ href: "/dashboard", label: "My business dashboard" });
  }

  if (!accountLinks.length && isVisitor) {
    accountLinks.push(
      { href: "/visitor", label: "My favorites" },
      { href: "/visitor", label: "My account" }
    );
  }

  if (!accountLinks.length) {
    accountLinks.push({ href: "/dashboard", label: "My listing" });
  }

  const accountLabel = hasAdminAccess
    ? hasBusinessAccess
      ? "Admin + business account"
      : "Admin account"
    : isVisitor
      ? "MKE Black member"
      : "Business owner";
  const setupHref = hasAdminAccess
    ? "/admin"
    : hasBusinessAccess
      ? "/dashboard"
      : "/visitor";

  useEffect(() => {
    if (
      !menuOpen &&
      !exploreOpen &&
      !supportOpen &&
      !mobileMenuOpen &&
      !guestAccountOpen
    ) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setExploreOpen(false);
        setSupportOpen(false);
        setMobileMenuOpen(false);
        setGuestAccountOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setExploreOpen(false);
        setSupportOpen(false);
        setMobileMenuOpen(false);
        setGuestAccountOpen(false);
        setSetupGuideOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, exploreOpen, supportOpen, mobileMenuOpen, guestAccountOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-charcoal/95 backdrop-blur-xl">
      <div ref={menuRef} className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
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
          <div className="min-w-0">
            <p className="font-display text-xl font-black tracking-tight text-ink transition group-hover:text-accent">
              MKE Black
            </p>
            <p className="hidden text-[10px] uppercase tracking-[0.22em] text-muted lg:block">
              Milwaukee Black Business Directory
            </p>
          </div>
        </Link>

        <nav className="flex flex-1 items-center justify-end gap-2">
          <HeaderDropdown
            label="Menu"
            open={mobileMenuOpen}
            onToggle={() => {
              setMobileMenuOpen((current) => !current);
              setExploreOpen(false);
              setSupportOpen(false);
              setGuestAccountOpen(false);
              setMenuOpen(false);
              setSetupGuideOpen(false);
            }}
            links={[...primaryLinks, ...exploreLinks, ...supportLinks]}
            className="md:hidden"
          />

          <div className="hidden items-center gap-2 md:flex">
            {primaryLinks.map((link) => (
              <HeaderLink key={link.href} {...link} />
            ))}

            <HeaderDropdown
              label="Explore"
              open={exploreOpen}
              onToggle={() => {
                setExploreOpen((current) => !current);
                setSupportOpen(false);
                setMobileMenuOpen(false);
                setGuestAccountOpen(false);
                setMenuOpen(false);
                setSetupGuideOpen(false);
              }}
              links={exploreLinks}
            />

            <HeaderDropdown
              label="Support"
              open={supportOpen}
              onToggle={() => {
                setSupportOpen((current) => !current);
                setExploreOpen(false);
                setMobileMenuOpen(false);
                setGuestAccountOpen(false);
                setMenuOpen(false);
                setSetupGuideOpen(false);
              }}
              links={supportLinks}
            />
          </div>

          <SetupGuideTrigger
            onClick={() => {
              setSetupGuideOpen(true);
              setMenuOpen(false);
              setExploreOpen(false);
              setSupportOpen(false);
              setMobileMenuOpen(false);
              setGuestAccountOpen(false);
            }}
          />

          {loading ? (
            <span className="rounded-full border border-line px-4 py-2 text-sm text-muted">…</span>
          ) : user ? (
            <>
            <NotificationBell uid={user.uid} />
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Open account menu"
                onClick={() => {
                  setMenuOpen((current) => !current);
                  setExploreOpen(false);
                  setSupportOpen(false);
                  setMobileMenuOpen(false);
                  setGuestAccountOpen(false);
                  setSetupGuideOpen(false);
                }}
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
                <div className="absolute right-0 top-full z-[60] mt-3 w-72 rounded-2xl border border-line bg-canvas/95 p-3 shadow-glow backdrop-blur-xl">
                  <div className="rounded-xl border border-line bg-panelAlt/70 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
                      {accountLabel}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {user.displayName || user.email || "MKE Black account"}
                    </p>
                    {user.email && (
                      <p className="mt-0.5 text-xs text-stone-400">{user.email}</p>
                    )}
                    <Link
                      href={setupHref}
                      onClick={() => setMenuOpen(false)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold text-accentSoft transition hover:bg-accent/15"
                    >
                      <span aria-hidden="true">⚙</span>
                      Account setup
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5">
                    {accountLinks.map((link, index) => (
                      <Link
                        key={`${link.href}-${index}`}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-xl border border-line bg-canvas/70 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/45 hover:bg-panelAlt/90 hover:text-accent"
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
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={guestAccountOpen}
                onClick={() => {
                  setGuestAccountOpen((current) => !current);
                  setExploreOpen(false);
                  setSupportOpen(false);
                  setMobileMenuOpen(false);
                  setSetupGuideOpen(false);
                }}
                className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
              >
                Account
              </button>
              {guestAccountOpen ? (
                <div className="absolute right-0 top-full z-[60] mt-3 w-64 rounded-2xl border border-line bg-canvas/95 p-3 shadow-glow backdrop-blur-xl">
                  <div className="flex flex-col gap-1.5">
                    <DropdownLink
                      href="/login?next=/admin"
                      label="Admin Login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                    <DropdownLink
                      href="/login"
                      label="Business Login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                    <DropdownLink
                      href="/join"
                      label="Visitor Login"
                      onSelect={() => setGuestAccountOpen(false)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <SetupGuideDrawer
            open={setupGuideOpen}
            onClose={() => setSetupGuideOpen(false)}
          />
        </nav>
      </div>
    </header>
  );
}
