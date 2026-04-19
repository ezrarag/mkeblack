"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";

type AdminUser = {
  uid: string;
  email: string;
  name: string;
  provisionedAt: string | null;
};

type PendingInvite = {
  email: string;
  name: string;
  invitedAt: string | null;
};

type ProvisionResult = {
  success: boolean;
  uid: string | null;
  email: string;
  kind: "promoted-existing" | "invited-google" | "refreshed-invite";
  message: string;
};

type TeamResponse = {
  admins: AdminUser[];
  invites: PendingInvite[];
};

export function AdminTeamPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const apiFetch = useCallback(
    async (method: "GET" | "POST" | "DELETE", body?: object) => {
      if (!user) {
        throw new Error("You must be signed in as an admin to manage team access.");
      }

      const token = await user.getIdToken();

      return fetch("/api/provision-admin", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : undefined
      });
    },
    [user]
  );

  const loadTeamAccess = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      const res = await apiFetch("GET");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load team access");
      }

      const data = (await res.json()) as TeamResponse;
      setAdmins(data.admins ?? []);
      setInvites(data.invites ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadTeamAccess();
  }, [loadTeamAccess, user]);

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    setFormError(null);

    try {
      const res = await apiFetch("POST", { email, name });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to add admin access");
      }

      setResult(data as ProvisionResult);
      setEmail("");
      setName("");
      void loadTeamAccess();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveAdmin(uid: string) {
    setRemovingKey(uid);

    try {
      const res = await apiFetch("DELETE", { uid });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove admin");
      }

      void loadTeamAccess();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRemovingKey(null);
    }
  }

  async function handleRevokeInvite(inviteEmail: string) {
    setRemovingKey(inviteEmail);

    try {
      const res = await apiFetch("DELETE", { email: inviteEmail });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke invite");
      }

      void loadTeamAccess();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.4rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
            Admin workspace
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
            Team access.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
            Add MKE Black staff as admins by email. If they already have an
            account, it is promoted immediately. If they have never signed in,
            the app stores a Google invite and they can use{" "}
            <code className="rounded bg-panelAlt px-2 py-0.5 text-accentSoft">
              Continue with Google
            </code>{" "}
            on <code className="rounded bg-panelAlt px-2 py-0.5 text-accentSoft">/login</code>.
          </p>
        </div>

        <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Add admin
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-400">
            Use the exact Google Workspace or Gmail address they should sign in
            with on staging.
          </p>

          <form
            onSubmit={handleProvision}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Name
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Jasmine Williams"
                className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Email <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@mkeblack.org"
                required
                className="w-full rounded-2xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between gap-4 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Add Google admin"}
              </button>
              {formError ? (
                <p className="text-sm text-rose-400">{formError}</p>
              ) : null}
            </div>
          </form>

          {result ? (
            <div
              className={`mt-6 rounded-2xl border px-5 py-5 ${
                result.kind === "promoted-existing"
                  ? "border-success/35 bg-success/10"
                  : "border-accent/35 bg-accent/10"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.22em] text-muted">
                {result.kind === "promoted-existing"
                  ? "Existing account promoted"
                  : "Google invite saved"}
              </p>
              <p className="mt-2 text-sm font-medium text-stone-100">
                {result.email}
              </p>
              <p className="mt-1 text-sm text-stone-300">{result.message}</p>

              {result.kind !== "promoted-existing" ? (
                <div className="mt-4 rounded-xl border border-line bg-canvas/40 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Send them this instruction
                  </p>
                  <p className="mt-2 text-sm leading-7 text-stone-300">
                    Go to <code className="text-stone-100">/login</code>, click{" "}
                    <span className="text-stone-100">Continue with Google</span>,
                    and use <span className="text-stone-100">{result.email}</span>.
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setResult(null)}
                className="mt-4 text-xs text-stone-500 underline underline-offset-4 transition hover:text-stone-300"
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Current admins
            </p>
            <button
              type="button"
              onClick={() => void loadTeamAccess()}
              className="rounded-full border border-line px-4 py-2 text-xs text-stone-400 transition hover:border-accent/40 hover:text-accentSoft"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((value) => (
                <div
                  key={value}
                  className="h-16 animate-pulse rounded-2xl border border-line bg-panelAlt/60"
                />
              ))}
            </div>
          ) : fetchError ? (
            <p className="mt-4 text-sm text-rose-400">{fetchError}</p>
          ) : !admins.length ? (
            <p className="mt-4 text-sm text-stone-500">
              No admins found yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {admins.map((admin) => (
                <div
                  key={admin.uid}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/60 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-100">
                      {admin.name || admin.email}
                    </p>
                    {admin.name ? (
                      <p className="mt-0.5 text-xs text-stone-500">
                        {admin.email}
                      </p>
                    ) : null}
                    {admin.provisionedAt ? (
                      <p className="mt-0.5 text-xs text-stone-600">
                        Added {new Date(admin.provisionedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAdmin(admin.uid)}
                    disabled={removingKey === admin.uid}
                    className="rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-xs text-rose-300 transition hover:bg-danger/20 disabled:opacity-50"
                  >
                    {removingKey === admin.uid ? "Removing…" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Pending Google invites
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-400">
            These emails can become admins the first time they use Google sign-in.
          </p>

          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2].map((value) => (
                <div
                  key={value}
                  className="h-16 animate-pulse rounded-2xl border border-line bg-panelAlt/60"
                />
              ))}
            </div>
          ) : fetchError ? null : !invites.length ? (
            <p className="mt-4 text-sm text-stone-500">
              No pending Google invites.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.email}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/60 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-100">
                      {invite.name || invite.email}
                    </p>
                    {invite.name ? (
                      <p className="mt-0.5 text-xs text-stone-500">
                        {invite.email}
                      </p>
                    ) : null}
                    {invite.invitedAt ? (
                      <p className="mt-0.5 text-xs text-stone-600">
                        Invited {new Date(invite.invitedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(invite.email)}
                    disabled={removingKey === invite.email}
                    className="rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-xs text-rose-300 transition hover:bg-danger/20 disabled:opacity-50"
                  >
                    {removingKey === invite.email ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </ProtectedRoute>
  );
}
