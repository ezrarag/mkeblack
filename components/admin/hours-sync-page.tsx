"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { HoursEditor } from "@/components/forms/hours-editor";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import {
  formatReadableHours,
  isBusinessEligibleForHoursSync,
  normalizeAdminSyncSessionRecord
} from "@/lib/hours-sync";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { createClosedBusinessHours } from "@/lib/constants";
import {
  AdminHoursSyncResult,
  AdminSyncSession,
  BusinessHours,
  DayKey
} from "@/lib/types";

function cloneHours(hours: BusinessHours) {
  return {
    monday: { ...hours.monday },
    tuesday: { ...hours.tuesday },
    wednesday: { ...hours.wednesday },
    thursday: { ...hours.thursday },
    friday: { ...hours.friday },
    saturday: { ...hours.saturday },
    sunday: { ...hours.sunday }
  };
}

function estimateMinutesRemaining(session: AdminSyncSession | null) {
  if (!session || session.processed >= session.total) {
    return 0;
  }

  return Math.ceil((session.total - session.processed) / 10);
}

function buildProgressWidth(session: AdminSyncSession | null) {
  if (!session || !session.total) {
    return "0%";
  }

  return `${Math.min(100, Math.round((session.processed / session.total) * 100))}%`;
}

export function HoursSyncPage() {
  const { user } = useAuth();
  const { businesses, loading, error } = useAllBusinesses();
  const [session, setSession] = useState<AdminSyncSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedHours, setEditedHours] = useState<Record<string, BusinessHours>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const eligibleCount = useMemo(
    () => businesses.filter((business) => isBusinessEligibleForHoursSync(business)).length,
    [businesses]
  );

  const apiPost = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!user) {
        throw new Error("You must be signed in as an admin.");
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/admin/scrape-hours", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Hours sync request failed."
        );
      }

      return data;
    },
    [user]
  );

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;
    let cancelled = false;

    async function start() {
      if (!user) {
        return;
      }

      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);

      if (cancelled || !db) {
        return;
      }

      unsubscribe = firestoreModule.onSnapshot(
        firestoreModule.query(
          firestoreModule.collection(db, "admin_sync_sessions"),
          firestoreModule.orderBy("updatedAt", "desc"),
          firestoreModule.limit(1)
        ),
        (snapshot) => {
          const latest = snapshot.docs[0];
          setSession(
            latest
              ? normalizeAdminSyncSessionRecord(latest.data(), latest.id)
              : null
          );
        }
      );
    }

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  const processNextBatch = useCallback(
    async (sessionId: string) => {
      if (processing) {
        return;
      }

      setProcessing(true);

      try {
        await apiPost({
          action: "process",
          sessionId
        });
      } catch (error) {
        setFeedbackTone("error");
        setFeedback(error instanceof Error ? error.message : "Batch processing failed.");
      } finally {
        setProcessing(false);
      }
    },
    [apiPost, processing]
  );

  useEffect(() => {
    if (!session || session.status !== "running" || session.processed >= session.total) {
      return;
    }

    const lastBatchAt = session.lastBatchAt?.getTime() ?? 0;
    const elapsed = Date.now() - lastBatchAt;
    const delay = lastBatchAt ? Math.max(0, 60_000 - elapsed) : 0;
    const timer = window.setTimeout(() => {
      void processNextBatch(session.id);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [processNextBatch, session]);

  async function handleStartSync() {
    setStarting(true);
    setFeedback(null);

    try {
      const data = await apiPost({ action: "start" });
      const sessionId = typeof data.sessionId === "string" ? data.sessionId : "";
      const total = typeof data.total === "number" ? data.total : 0;

      setFeedbackTone("success");
      setFeedback(
        total
          ? `Started a sync session for ${total} businesses with no hours set.`
          : "No imported businesses need hours sync right now."
      );

      if (sessionId && total > 0) {
        await processNextBatch(sessionId);
      }
    } catch (error) {
      setFeedbackTone("error");
      setFeedback(error instanceof Error ? error.message : "Unable to start sync.");
    } finally {
      setStarting(false);
    }
  }

  function getDraftHours(result: AdminHoursSyncResult) {
    return editedHours[result.businessId] ??
      cloneHours(result.proposedHours ?? createClosedBusinessHours());
  }

  function updateDraftHours(
    businessId: string,
    day: DayKey,
    field: "open" | "close" | "closed",
    value: string | boolean
  ) {
    setEditedHours((current) => {
      const nextHours = cloneHours(
        current[businessId] ?? createClosedBusinessHours()
      );

      nextHours[day] = {
        ...nextHours[day],
        [field]: value
      };

      return {
        ...current,
        [businessId]: nextHours
      };
    });
  }

  async function handleApprove(result: AdminHoursSyncResult, hours: BusinessHours) {
    if (!session) {
      return;
    }

    setActingId(result.businessId);
    setFeedback(null);

    try {
      await apiPost({
        action: "approve",
        sessionId: session.id,
        businessId: result.businessId,
        hours
      });
      setFeedbackTone("success");
      setFeedback(`Approved hours for ${result.businessName}.`);
      setEditingId(null);
    } catch (error) {
      setFeedbackTone("error");
      setFeedback(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setActingId(null);
    }
  }

  async function handleSkip(result: AdminHoursSyncResult) {
    if (!session) {
      return;
    }

    setActingId(result.businessId);
    setFeedback(null);

    try {
      await apiPost({
        action: "skip",
        sessionId: session.id,
        businessId: result.businessId
      });
      setFeedbackTone("success");
      setFeedback(`Skipped ${result.businessName} for future hours sync runs.`);
    } catch (error) {
      setFeedbackTone("error");
      setFeedback(error instanceof Error ? error.message : "Skip failed.");
    } finally {
      setActingId(null);
    }
  }

  const reviewResults = useMemo(() => {
    if (!session) {
      return [];
    }

    return [...session.results].sort((left, right) => {
      const leftPriority = left.status === "found" ? 0 : left.status === "error" ? 1 : 2;
      const rightPriority = right.status === "found" ? 0 : right.status === "error" ? 1 : 2;
      return leftPriority - rightPriority;
    });
  }, [session]);

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="h-40 animate-pulse rounded-[2.4rem] border border-line bg-panel/70" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <StatePanel title="Unable to load businesses" description={error} />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.6rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Hours sync
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Recover missing weekly hours.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                Scan imported businesses with every day marked closed, pull proposed
                hours from Google Places in batches of ten per minute, then review
                each result before saving.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
            >
              Back to admin
            </Link>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-6 rounded-3xl px-5 py-4 text-sm ${
              feedbackTone === "success"
                ? "border border-success/35 bg-success/10 text-stone-100"
                : "border border-danger/35 bg-danger/10 text-stone-100"
            }`}
          >
            {feedback}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Step 1 — Scope
            </p>
            <h2 className="mt-3 font-display text-3xl text-ink">
              {eligibleCount} businesses have no hours set.
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-400">
              Eligible listings are imported businesses where every day is still
              marked closed and the admin has not skipped future sync attempts.
            </p>
            <button
              type="button"
              onClick={() => void handleStartSync()}
              disabled={starting || processing || !eligibleCount}
              className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? "Starting..." : "Start sync"}
            </button>
          </div>

          <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Step 2 — Live progress
            </p>
            {session ? (
              <>
                <p className="mt-3 text-sm leading-7 text-stone-300">
                  Processed {session.processed} of {session.total}
                  {session.total
                    ? ` (~${estimateMinutesRemaining(session)} min remaining)`
                    : ""}
                </p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-panelAlt/70">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: buildProgressWidth(session) }}
                  />
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">
                  {session.status === "completed"
                    ? "Latest session completed"
                    : processing
                    ? "Processing current batch"
                    : "Waiting for next batch window"}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-7 text-stone-400">
                No sync session yet. Start one to process businesses in batches of
                ten per minute and store the review queue in Firestore.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Step 3 — Review queue
          </p>

          {!session ? (
            <p className="mt-4 text-sm leading-7 text-stone-400">
              Start a sync session to populate this queue.
            </p>
          ) : !reviewResults.length ? (
            <p className="mt-4 text-sm leading-7 text-stone-400">
              No processed results yet. The queue will fill as batches complete.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {reviewResults.map((result) => {
                const isEditing = editingId === result.businessId;
                const draftHours = getDraftHours(result);
                const isFound = result.status === "found" || result.status === "approved";
                const isDone = result.status === "approved" || result.status === "skipped";

                return (
                  <div
                    key={result.businessId}
                    className="rounded-[2rem] border border-line bg-panelAlt/60 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-stone-100">
                          {result.businessName}
                        </p>
                        <p className="mt-1 text-sm text-stone-400">{result.address}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">
                          {result.status === "found" || result.status === "approved"
                            ? "✓ Found on Google Places"
                            : result.status === "skipped"
                            ? "✗ Skipped from future syncs"
                            : "✗ Not found — skipped candidate"}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-stone-300">
                          {isFound && result.proposedHours
                            ? formatReadableHours(result.proposedHours)
                            : result.message}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isFound && !isDone ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleApprove(result, draftHours)}
                              disabled={actingId === result.businessId}
                              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-accentSoft disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingId((current) =>
                                  current === result.businessId ? null : result.businessId
                                )
                              }
                              disabled={actingId === result.businessId}
                              className="rounded-full border border-line px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft disabled:opacity-50"
                            >
                              Edit + Approve
                            </button>
                          </>
                        ) : null}
                        {!isDone ? (
                          <button
                            type="button"
                            onClick={() => void handleSkip(result)}
                            disabled={actingId === result.businessId}
                            className="rounded-full border border-danger/35 bg-danger/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-danger/20 disabled:opacity-50"
                          >
                            Skip
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isEditing && isFound ? (
                      <div className="mt-5 rounded-[1.8rem] border border-line bg-panel/70 p-5">
                        <HoursEditor
                          hours={draftHours}
                          onChange={(day, field, value) =>
                            updateDraftHours(result.businessId, day, field, value)
                          }
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleApprove(result, draftHours)}
                            disabled={actingId === result.businessId}
                            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft disabled:opacity-50"
                          >
                            Approve edited hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
                          >
                            Cancel editing
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </ProtectedRoute>
  );
}
