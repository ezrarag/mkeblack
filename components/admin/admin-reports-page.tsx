"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import {
  BusinessReport,
  normalizeBusinessReport
} from "@/lib/firebase/business-reports";
import { formatFirebaseError } from "@/lib/firebase-errors";

export function AdminReportsPage() {
  const [reports, setReports] = useState<BusinessReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);
      if (!db) return;

      const snapshot = await firestoreModule.getDocs(
        firestoreModule.query(
          firestoreModule.collection(db, "business_reports"),
          firestoreModule.where("status", "==", "open"),
          firestoreModule.limit(100)
        )
      );

      setReports(
        snapshot.docs
          .map((doc) => normalizeBusinessReport(doc.data(), doc.id))
          .sort(
            (left, right) =>
              (right.createdAt?.getTime() ?? 0) -
              (left.createdAt?.getTime() ?? 0)
          )
      );
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function resolveReport(
    report: BusinessReport,
    status: "resolved" | "dismissed",
    deactivate = false
  ) {
    setActingId(report.id);
    setFeedback(null);
    try {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);
      if (!db) return;

      const writes = [
        firestoreModule.setDoc(
          firestoreModule.doc(db, "business_reports", report.id),
          {
            status,
            resolvedAt: firestoreModule.serverTimestamp()
          },
          { merge: true }
        )
      ];

      if (deactivate) {
        writes.push(
          firestoreModule.setDoc(
            firestoreModule.doc(db, "businesses", report.businessId),
            { active: false },
            { merge: true }
          )
        );
      }

      await Promise.all(writes);
      setFeedback(deactivate ? "Business deactivated and report resolved." : "Report updated.");
      void loadReports();
    } catch (err) {
      setFeedback(formatFirebaseError(err));
    } finally {
      setActingId(null);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
            Admin
          </p>
          <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink">
            Business reports
          </h1>
          <p className="mt-4 text-sm leading-8 text-stone-300">
            Review public reports for closed businesses, incorrect hours,
            wrong contact details, and other listing issues.
          </p>
        </div>

        {feedback ? (
          <div className="mt-6 rounded-2xl border border-line bg-panelAlt/60 px-4 py-3 text-sm text-stone-200">
            {feedback}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-line bg-panel/70"
              />
            ))
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas/30 px-6 py-10 text-center text-sm text-stone-400">
              No open reports.
            </div>
          ) : (
            reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-line bg-panel/80 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/business/${report.businessId}`}
                      className="font-semibold text-stone-100 transition hover:text-accentSoft"
                    >
                      {report.businessName}
                    </Link>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-accent">
                      {report.reason}
                    </p>
                    {report.comment ? (
                      <p className="mt-3 text-sm leading-7 text-stone-300">
                        {report.comment}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-stone-500">
                      {report.reporterEmail || "No reporter email"} ·{" "}
                      {report.createdAt?.toLocaleString() ?? "Date unavailable"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actingId === report.id}
                      onClick={() => resolveReport(report, "resolved", true)}
                      className="rounded-full border border-danger/35 bg-danger/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-danger/20 disabled:opacity-50"
                    >
                      Deactivate business
                    </button>
                    <button
                      type="button"
                      disabled={actingId === report.id}
                      onClick={() => resolveReport(report, "resolved")}
                      className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold text-accentSoft transition hover:bg-accent/15 disabled:opacity-50"
                    >
                      Mark resolved
                    </button>
                    <button
                      type="button"
                      disabled={actingId === report.id}
                      onClick={() => resolveReport(report, "dismissed")}
                      className="rounded-full border border-line px-4 py-2 text-xs text-stone-400 transition hover:text-ink disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </ProtectedRoute>
  );
}
