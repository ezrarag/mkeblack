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
  const { user, loading, hasAdminAccess } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
          <div className="flex flex-col gap-4">
            <Link
              href="/dashboard"
              className="inline-flex w-fit rounded-full border border-accent/35 bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
            >
              Go to dashboard
            </Link>

            <div className="w-fit rounded-2xl border border-line/80 bg-canvas/45 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                Firebase UID
              </p>
              <code className="mt-2 block break-all text-sm text-stone-100">
                {user.uid}
              </code>
            </div>
          </div>
        }
      />
    );
  }

  return <>{children}</>;
}
