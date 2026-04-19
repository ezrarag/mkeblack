"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState
} from "react";
import type { User } from "firebase/auth";
import {
  getFirebaseAuth,
  getFirebaseDb,
  loadFirebaseAuthModule,
  loadFirebaseFirestoreModule,
  isFirebaseConfigured
} from "@/lib/firebase/client";
import { UserProfile } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  hasAdminAccess: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  hasAdminAccess: false
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const hasAdminAccess = isAdmin || profile?.role === "admin";

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let authUnsubscribe: () => void = () => undefined;
    let profileUnsubscribe: () => void = () => undefined;

    async function syncPendingAdminInvite(nextUser: User) {
      const token = await nextUser.getIdToken();

      await fetch("/api/provision-admin", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    async function start() {
      try {
        const [authModule, firestoreModule, auth, db] = await Promise.all([
          loadFirebaseAuthModule(),
          loadFirebaseFirestoreModule(),
          getFirebaseAuth(),
          getFirebaseDb()
        ]);

        if (cancelled || !auth || !db) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        authUnsubscribe = authModule.onAuthStateChanged(auth, async (nextUser) => {
          profileUnsubscribe();
          setUser(nextUser);

          if (!nextUser) {
            setProfile(null);
            setIsAdmin(false);
            setLoading(false);
            return;
          }

          try {
            await syncPendingAdminInvite(nextUser);
          } catch {
            // Invite bootstrap is best-effort. Normal auth should still continue.
          }

          const tokenResult = await authModule.getIdTokenResult(nextUser, true);

          if (cancelled) {
            return;
          }

          setIsAdmin(Boolean(tokenResult.claims.admin));

          profileUnsubscribe = firestoreModule.onSnapshot(
            firestoreModule.doc(db, "users", nextUser.uid),
            (snapshot) => {
              setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
              setLoading(false);
            },
            () => {
              setProfile(null);
              setLoading(false);
            }
          );
        });
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      profileUnsubscribe();
      authUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, isAdmin, hasAdminAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
