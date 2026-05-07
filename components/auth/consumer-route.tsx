"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { StatePanel } from "@/components/ui/state-panel";
import { isFirebaseConfigured } from "@/lib/firebase/client";

type ConsumerRouteProps = {
  children: ReactNode;
};

/**
 * Route guard for visitor-only pages (e.g. /visitor dashboard).
 * Redirects unauthenticated users to /join.
 * Business owners and admins are allowed through (they can have favorites too).
 */
export function ConsumerRoute({ children }: ConsumerRouteProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/join?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  if (!isFirebaseConfigured) {
    return (
      <StatePanel
        title="Firebase configuration required"
        description="Add your Firebase environment variables in .env.local."
      />
    );
  }

  if (loading || !user) {
    return (
      <StatePanel
        title="Loading"
        description="Checking your session…"
      />
    );
  }

  return <>{children}</>;
}
