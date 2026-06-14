"use client";

import { useEffect, useState } from "react";
import {
  getFirebaseAuth,
  getFirebaseDb,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { UserProfile, UserRole } from "@/lib/types";

export type VisitorRecord = {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole | "unknown";
  businessId: string | null;
  createdAt: Date | null;
  authCreatedAt: Date | null;
  authLastSignInAt: Date | null;
  authProviderIds: string[];
  disabled: boolean;
  neighborhood: string | null;
  interests: string[];
  referralSource: string | null;
  lastAuthProviderId: string | null;
  lastLoginMethod: string | null;
  lastLoginIntent: string | null;
  lastLoginAt: Date | null;
  lastRequestedLoginMethod: string | null;
  passwordResetRequestedAt: Date | null;
};

type AuthUserSummary = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  providerIds: string[];
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function parseAuthDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRole(value: unknown): UserRole | "unknown" {
  return value === "admin" || value === "business" || value === "visitor"
    ? value
    : "unknown";
}

function providerMethod(providerIds: string[]) {
  if (providerIds.includes("google.com")) return "Google";
  if (providerIds.includes("password")) return "Email/password";
  return providerIds[0] ?? null;
}

async function loadAuthUsers(): Promise<AuthUserSummary[]> {
  const auth = await getFirebaseAuth();
  const token = await auth?.currentUser?.getIdToken();

  if (!token) {
    return [];
  }

  const response = await fetch("/api/admin/auth-users", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const payload = (await response.json()) as { users?: AuthUserSummary[] };

  return response.ok && Array.isArray(payload.users) ? payload.users : [];
}

/**
 * Loads all user profile docs and merges Firebase Auth provider metadata.
 * Firestore rules and the admin API both require admin access.
 */
export function useVisitors() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
      if (!isFirebaseConfigured) {
        setError("Firebase not configured.");
        setLoading(false);
        return;
      }

      try {
        const [firestoreModule, db] = await Promise.all([
          loadFirebaseFirestoreModule(),
          getFirebaseDb()
        ]);

        if (cancelled) return;
        if (!db) {
          setError("Firebase could not initialize.");
          setLoading(false);
          return;
        }

        unsubscribe = firestoreModule.onSnapshot(
          firestoreModule.collection(db, "users"),
          async (snapshot) => {
            let authUsers: AuthUserSummary[] = [];
            try {
              authUsers = await loadAuthUsers();
            } catch {
              authUsers = [];
            }

            if (cancelled) return;

            const profileByUid = new Map<string, Partial<UserProfile>>();
            snapshot.docs.forEach((doc) => {
              profileByUid.set(doc.id, doc.data() as Partial<UserProfile>);
            });
            const authByUid = new Map(authUsers.map((user) => [user.uid, user]));
            const allUids = Array.from(
              new Set([
                ...snapshot.docs.map((doc) => doc.id),
                ...authUsers.map((user) => user.uid)
              ])
            );

            const next = allUids.map((uid) => {
              const data = profileByUid.get(uid) ?? {};
              const authUser = authByUid.get(uid);
              const authCreatedAt = parseAuthDate(authUser?.createdAt);
              const authLastSignInAt = parseAuthDate(authUser?.lastSignInAt);
              const authProviderIds = authUser?.providerIds?.length
                ? authUser.providerIds
                : Array.isArray(data.authProviderIds)
                  ? data.authProviderIds.filter((item): item is string => typeof item === "string")
                  : [];

              return {
                uid,
                email: data.email ?? authUser?.email ?? "",
                role: normalizeRole(data.role),
                businessId: data.businessId ?? null,
                displayName: data.displayName ?? authUser?.displayName ?? null,
                createdAt: toDate(data.createdAt) ?? authCreatedAt,
                authCreatedAt,
                authLastSignInAt,
                authProviderIds,
                disabled: authUser?.disabled ?? false,
                neighborhood: data.neighborhood ?? null,
                interests: Array.isArray(data.interests) ? data.interests : [],
                referralSource: data.referralSource ?? null,
                lastAuthProviderId: data.lastAuthProviderId ?? null,
                lastLoginMethod: data.lastLoginMethod ?? providerMethod(authProviderIds),
                lastLoginIntent: data.lastLoginIntent ?? null,
                lastLoginAt: toDate(data.lastLoginAt),
                lastRequestedLoginMethod: data.lastRequestedLoginMethod ?? null,
                passwordResetRequestedAt: toDate(data.passwordResetRequestedAt)
              } satisfies VisitorRecord;
            });

            next.sort((a, b) => {
              const ta =
                a.authLastSignInAt?.getTime() ??
                a.lastLoginAt?.getTime() ??
                a.createdAt?.getTime() ??
                0;
              const tb =
                b.authLastSignInAt?.getTime() ??
                b.lastLoginAt?.getTime() ??
                b.createdAt?.getTime() ??
                0;
              return tb - ta;
            });
            setVisitors(next);
            setLoading(false);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load accounts.");
          setLoading(false);
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { visitors, loading, error };
}
