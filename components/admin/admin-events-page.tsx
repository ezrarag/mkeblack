"use client";

import { useCallback, useState } from "react";
import { AdminConfirmDialog, AdminFeedback } from "@/components/admin/admin-action-ui";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { BusinessEventsManager } from "@/components/events/business-events-manager";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import { useBusinessEvents } from "@/hooks/use-business-events";
import { isEventPast } from "@/lib/events";
import { deleteBusinessEvent } from "@/lib/firebase/events";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessEvent } from "@/lib/types";

function AdminEventsContent() {
  const { hasAdminAccess } = useAuth();
  const { events, loading, error } = useBusinessEvents({ enabled: hasAdminAccess });
  const { businesses } = useAllBusinesses();
  const eligibleBusinesses = businesses.filter((business) => business.solidarityMember);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BusinessEvent | null>(null);
  const selectedBusiness = eligibleBusinesses.find((business) => business.id === selectedBusinessId);
  const publishedCount = events.filter((event) => event.status === "published").length;
  const upcomingCount = events.filter((event) => event.status === "published" && !isEventPast(event)).length;

  async function confirmDelete() {
    const event = pendingDelete;
    if (!event) return;
    setDeletingId(event.id);
    setFeedback(null);
    try {
      await deleteBusinessEvent(event.id, event.imageUrl);
      setFeedback({ message: `“${event.title}” was deleted.`, error: false });
    } catch (deleteError) {
      setFeedback({ message: formatFirebaseError(deleteError), error: true });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  const cancelDelete = useCallback(() => {
    if (!deletingId) setPendingDelete(null);
  }, [deletingId]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">Admin</p>
        <h1 className="mt-1 font-display text-4xl font-black text-ink">Events</h1>
        <div className="mt-5 flex flex-wrap gap-3">
          {[{ label: "Total events", value: events.length }, { label: "Published", value: publishedCount }, { label: "Upcoming", value: upcomingCount }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-line bg-panelAlt/70 px-5 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted">{item.label}</p>
              <p className="mt-1.5 font-display text-2xl font-black text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {feedback ? <AdminFeedback message={feedback.message} tone={feedback.error ? "error" : "success"} /> : null}

      <div className="mt-6 rounded-2xl border border-line bg-panel/80 p-5">
        <label className="block text-xs uppercase tracking-[0.2em] text-muted">Create or edit events for a business</label>
        <select className="mt-3 min-h-11 w-full" value={selectedBusinessId} onChange={(event) => setSelectedBusinessId(event.target.value)}>
          <option value="">Choose a Solidarity Circle business</option>
          {eligibleBusinesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
        </select>
        {selectedBusiness ? <div className="mt-5"><BusinessEventsManager businessId={selectedBusiness.id} businessName={selectedBusiness.name} isSolidarityMember /></div> : null}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? <div className="h-36 animate-pulse rounded-2xl border border-line bg-panel/60" /> : error ? <div className="rounded-xl border border-danger/35 bg-danger/10 p-4 text-rose-300">{error}</div> : events.length ? events.map((event) => (
          <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-panelAlt/60 p-4">
            <div className="min-w-0"><p className="font-semibold text-stone-100">{event.title}</p><p className="mt-1 break-words text-xs text-stone-400">{event.businessName} · {event.status} · {event.startsAt?.toLocaleString() ?? "Date not set"}</p></div>
            <button type="button" onClick={() => setPendingDelete(event)} disabled={Boolean(deletingId)} className="min-h-11 rounded-full border border-danger/40 bg-danger/10 px-5 py-2 text-sm font-semibold text-rose-300 transition hover:bg-danger/20 disabled:opacity-50">Delete</button>
          </div>
        )) : <div className="rounded-2xl border border-dashed border-line p-8 text-center text-stone-400">No events yet.</div>}
      </div>
      <AdminConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.title ?? "event"}”?`}
        description="This permanently removes the event and its image. This action cannot be undone."
        busy={Boolean(deletingId)}
        onCancel={cancelDelete}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

export function AdminEventsPage() {
  return <ProtectedRoute requireAdmin><AdminEventsContent /></ProtectedRoute>;
}
