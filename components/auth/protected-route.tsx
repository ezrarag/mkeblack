"use client";

import Link from "next/link";
import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { StatePanel } from "@/components/ui/state-panel";
import { isFirebaseConfigured } from "@/lib/firebase/client";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAdmin?: boolean;
};

export function ProtectedRoute({
  children,
  requireAdmin = false
}: ProtectedRouteProps) {
  const { user, profile, loading, isAdmin } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasAdminAccess = isAdmin || profile?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  if (!isFirebaseConfigured) {
    return (
      <StatePanel
        title="Firebase configuration required"
        description="Add your Firebase environment variables in .env.local before using protected routes."
      />
    );
  }

  if (loading || !user) {
    return (
      <StatePanel
        title="Checking access"
        description="Your Firebase session is loading. If you are not signed in, this page will redirect to the login screen."
      />
    );
  }

  if (requireAdmin && !hasAdminAccess) {
    return (
      <StatePanel
        title="Admin access required"
        description="This workspace is reserved for admins. Use an account with the admin custom claim or an admin role document."
        action={
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-accent/35 bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
          >
            Go to dashboard
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
