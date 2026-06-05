"use client";

import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { TeamMemberRoleType } from "@/lib/types";

type PendingClaim = {
  id: string;
  businessId: string;
  businessName: string;
  claimedByUid: string;
  claimedByEmail: string;
  claimedByName: string;
  requestedRoleType: TeamMemberRoleType;
  status: string;
  claimedAt: string;
};

const roleLabels: Record<TeamMemberRoleType, string> = {
  owner: "Primary owner",
  co_owner: "Co-owner",
  team: "Team member"
};

function normalizeRequestedRole(value: unknown): TeamMemberRoleType {
  return value === "co_owner" || value === "team" ? value : "owner";
}

export function AdminClaimsPage() {
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);
      if (!db) return;

      const snap = await firestoreModule.getDocs(
        firestoreModule.query(
          firestoreModule.collection(db, "pending_claims"),
          firestoreModule.where("status", "==", "pending_verification"),
          firestoreModule.orderBy("claimedAt", "desc"),
          firestoreModule.limit(50)
        )
      );

      setClaims(
        snap.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            businessId: d.businessId ?? "",
            businessName: d.businessName ?? "",
            claimedByUid: d.claimedByUid ?? "",
            claimedByEmail: d.claimedByEmail ?? "",
            claimedByName: d.claimedByName ?? "",
            requestedRoleType: normalizeRequestedRole(d.requestedRoleType),
            status: d.status ?? "",
            claimedAt: d.claimedAt?.toDate?.()?.toLocaleDateString() ?? "—"
          };
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadClaims(); }, [loadClaims]);

  async function handleVerify(claim: PendingClaim, approve: boolean) {
    setActingId(claim.id);
    setFeedback(null);

    try {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);
      if (!db) return;

      if (approve) {
        if (claim.requestedRoleType === "owner") {
          await Promise.all([
            firestoreModule.setDoc(
              firestoreModule.doc(db, "businesses", claim.businessId),
              {
                ownerUid: claim.claimedByUid,
                claimInviteStatus: "claimed"
              },
              { merge: true }
            ),
            firestoreModule.setDoc(
              firestoreModule.doc(db, "users", claim.claimedByUid),
              {
                uid: claim.claimedByUid,
                email: claim.claimedByEmail,
                role: "business",
                businessId: claim.businessId
              },
              { merge: true }
            )
          ]);
        } else {
          await Promise.all([
            firestoreModule.setDoc(
              firestoreModule.doc(
                db,
                "businesses",
                claim.businessId,
                "team",
                claim.claimedByUid
              ),
              {
                id: claim.claimedByUid,
                uid: claim.claimedByUid,
                name: claim.claimedByName || claim.claimedByEmail,
                role:
                  claim.requestedRoleType === "co_owner"
                    ? "Co-owner"
                    : "Team member",
                roleType: claim.requestedRoleType,
                title: "",
                pronouns: "",
                bio: "",
                photoUrl: "",
                linkedinUrl: "",
                instagramUrl: "",
                facebookUrl: "",
                tiktokUrl: "",
                email: claim.claimedByEmail,
                phone: "",
                website: "",
                displayContact: false,
                order: Date.now(),
                isOwner: false,
                visible: true,
                addedAt: firestoreModule.serverTimestamp()
              },
              { merge: true }
            ),
            firestoreModule.setDoc(
              firestoreModule.doc(db, "businesses", claim.businessId),
              { hasTeamProfiles: true },
              { merge: true }
            ),
            firestoreModule.setDoc(
              firestoreModule.doc(db, "users", claim.claimedByUid),
              {
                uid: claim.claimedByUid,
                email: claim.claimedByEmail,
                role: "business",
                businessId: claim.businessId
              },
              { merge: true }
            )
          ]);
        }

        await firestoreModule.setDoc(
          firestoreModule.doc(db, "pending_claims", claim.id),
          {
            status: "approved",
            approvedRoleType: claim.requestedRoleType,
            resolvedAt: firestoreModule.serverTimestamp()
          },
          { merge: true }
        );
        setFeedback(`Approved — ${claim.businessName} is confirmed as ${roleLabels[claim.requestedRoleType]} for ${claim.claimedByEmail}`);
      } else {
        await disassociateClaim(firestoreModule, db, claim, "rejected");
        setFeedback(`Rejected — ${claim.businessName} unlinked from ${claim.claimedByEmail}`);
      }

      void loadClaims();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  async function disassociateClaim(
    firestoreModule: Awaited<ReturnType<typeof loadFirebaseFirestoreModule>>,
    db: NonNullable<Awaited<ReturnType<typeof getFirebaseDb>>>,
    claim: PendingClaim,
    status: "rejected" | "deleted"
  ) {
    const writes = [
      firestoreModule.setDoc(
        firestoreModule.doc(db, "users", claim.claimedByUid),
        { businessId: null },
        { merge: true }
      )
    ];

    if (claim.requestedRoleType === "owner") {
      writes.push(
        firestoreModule.setDoc(
          firestoreModule.doc(db, "businesses", claim.businessId),
          { ownerUid: null, claimInviteStatus: "not_invited" },
          { merge: true }
        )
      );
    } else {
      writes.push(
        firestoreModule.deleteDoc(
          firestoreModule.doc(
            db,
            "businesses",
            claim.businessId,
            "team",
            claim.claimedByUid
          )
        )
      );
    }

    if (status === "deleted") {
      writes.push(
        firestoreModule.deleteDoc(
          firestoreModule.doc(db, "pending_claims", claim.id)
        )
      );
    } else {
      writes.push(
        firestoreModule.setDoc(
          firestoreModule.doc(db, "pending_claims", claim.id),
          { status, resolvedAt: firestoreModule.serverTimestamp() },
          { merge: true }
        )
      );
    }

    await Promise.all(writes);
  }

  async function handleDeleteClaim(claim: PendingClaim) {
    const confirmed = window.confirm(
      `Delete this claim and disassociate ${claim.claimedByEmail} from ${claim.businessName}?`
    );

    if (!confirmed) {
      return;
    }

    setActingId(claim.id);
    setFeedback(null);

    try {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);
      if (!db) return;

      await disassociateClaim(firestoreModule, db, claim, "deleted");
      setFeedback(`Deleted claim and disassociated ${claim.claimedByEmail}.`);
      void loadClaims();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">Admin</p>
          <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink">
            Pending claims.
          </h1>
          <p className="mt-4 text-sm leading-8 text-stone-300">
            Business owners who searched and self-claimed their listing.
            Review each one and approve or reject. Approved claims confirm
            the user as the official listing owner. Rejected claims unlink
            the user immediately.
          </p>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-line bg-panelAlt/60 px-4 py-3 text-sm text-stone-200">
            {feedback}
          </div>
        )}

        <div className="rounded-2xl border border-line bg-panel/85 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Awaiting verification
            </p>
            <button
              type="button"
              onClick={() => void loadClaims()}
              className="rounded-full border border-line px-4 py-2 text-xs text-stone-400 hover:text-accentSoft transition"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 animate-pulse rounded-2xl border border-line bg-panelAlt/60" />
              ))}
            </div>
          ) : !claims.length ? (
            <p className="text-sm text-stone-500">No pending claims — you&apos;re all caught up.</p>
          ) : (
            <div className="space-y-3">
              {claims.map(claim => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/60 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-100">{claim.businessName}</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      Claimed by <span className="text-stone-200">{claim.claimedByEmail}</span>
                      {" · "}{roleLabels[claim.requestedRoleType]}
                      {" · "}{claim.claimedAt}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-600 font-mono">{claim.claimedByUid}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleVerify(claim, true)}
                      disabled={actingId === claim.id}
                      className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accentSoft transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify(claim, false)}
                      disabled={actingId === claim.id}
                      className="rounded-full border border-danger/30 bg-danger/10 px-4 py-2 text-xs text-rose-300 hover:bg-danger/20 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClaim(claim)}
                      disabled={actingId === claim.id}
                      className="rounded-full border border-line px-4 py-2 text-xs text-stone-400 hover:border-danger/40 hover:text-rose-300 transition disabled:opacity-50"
                    >
                      Delete link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>
    </ProtectedRoute>
  );
}
