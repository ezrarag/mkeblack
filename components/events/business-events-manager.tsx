"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useBusinessEvents } from "@/hooks/use-business-events";
import {
  deleteBusinessEvent,
  saveBusinessEvent,
  uploadEventImage
} from "@/lib/firebase/events";
import { formatFirebaseError } from "@/lib/firebase-errors";
import {
  BusinessEvent,
  BusinessEventFormValues,
  EventTicketType
} from "@/lib/types";

type BusinessEventsManagerProps = {
  businessId: string;
  businessName: string;
  isSolidarityMember: boolean;
};

const EMPTY_TICKET: EventTicketType = {
  id: "",
  name: "General admission",
  description: "",
  priceCents: 0,
  quantityTotal: 50,
  quantitySold: 0,
  active: true
};

const EMPTY_FORM: BusinessEventFormValues = {
  title: "",
  description: "",
  imageUrl: "",
  venueName: "",
  address: "",
  startsAt: "",
  endsAt: "",
  status: "draft",
  ticketTypes: [EMPTY_TICKET]
};

function toDateTimeInputValue(date: Date | null) {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function priceDisplay(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(2)}` : "Free RSVP";
}

function EventRow({
  event,
  onEdit,
  onDelete
}: {
  event: BusinessEvent;
  onEdit: (event: BusinessEvent) => void;
  onDelete: (event: BusinessEvent) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-line bg-panelAlt/60 p-4">
      {event.imageUrl ? (
        <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-line">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas/50 text-xs font-semibold uppercase tracking-[0.18em] text-stone-600">
          Event
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-stone-100">{event.title}</p>
            <p className="text-xs text-stone-500">
              {event.startsAt
                ? event.startsAt.toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })
                : "Date not set"}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
              event.status === "published"
                ? "border border-success/40 bg-success/10 text-success"
                : event.status === "cancelled"
                  ? "border border-danger/30 bg-danger/10 text-rose-300"
                  : "border border-line bg-panelAlt text-stone-500"
            }`}
          >
            {event.status}
          </span>
        </div>
        <p className="mt-2 text-xs text-stone-400">
          {event.ticketTypes.length
            ? event.ticketTypes.map((ticket) => priceDisplay(ticket.priceCents)).join(" · ")
            : "No tickets configured"}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="rounded-lg border border-line bg-panelAlt/60 px-3 py-1.5 text-xs text-stone-200 transition hover:border-accent/40 hover:text-ink"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(event)}
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-danger/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function BusinessEventsManager({
  businessId,
  businessName,
  isSolidarityMember
}: BusinessEventsManagerProps) {
  const { events, loading, error } = useBusinessEvents({ businessId });
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BusinessEventFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BusinessEvent | null>(null);
  const [feedback, setFeedback] = useState<{
    msg: string;
    tone: "success" | "error";
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://mkeblack.org";
  const eventPageUrl = `${baseUrl}/events`;
  const embedUrl = `${baseUrl}/embed/events/${businessId}`;
  const icsUrl = `${baseUrl}/api/events/${businessId}/calendar.ics`;
  const iframeSnippet = `<iframe src="${embedUrl}" style="width:100%;border:0;" height="420"></iframe>`;

  if (!isSolidarityMember) {
    return (
      <div className="rounded-2xl border border-line bg-panel/80 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          Events
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink">
          Solidarity Circle members only
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-300">
          Event posting and ticketing are available to Solidarity Circle
          businesses. Admins can comp membership from the business editor when
          MKE Black furnishes access.
        </p>
        <Link
          href="/membership"
          className="mt-5 inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
        >
          Join Solidarity Circle
        </Link>
      </div>
    );
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  }

  function openEdit(event: BusinessEvent) {
    setEditing(event.id);
    setForm({
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      venueName: event.venueName,
      address: event.address,
      startsAt: toDateTimeInputValue(event.startsAt),
      endsAt: toDateTimeInputValue(event.endsAt),
      status: event.status,
      ticketTypes: event.ticketTypes.length ? event.ticketTypes : [EMPTY_TICKET]
    });
    setFeedback(null);
    setFormOpen(true);
  }

  function updateField<K extends keyof BusinessEventFormValues>(
    key: K,
    value: BusinessEventFormValues[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTicket(index: number, patch: Partial<EventTicketType>) {
    setForm((current) => ({
      ...current,
      ticketTypes: current.ticketTypes.map((ticket, ticketIndex) =>
        ticketIndex === index ? { ...ticket, ...patch } : ticket
      )
    }));
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      updateField("imageUrl", await uploadEventImage(businessId, file));
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveBusinessEvent(
        businessId,
        businessName,
        isSolidarityMember,
        editing,
        form
      );
      setFeedback({
        msg: editing ? "Event updated." : "Event created.",
        tone: "success"
      });
      setFormOpen(false);
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: BusinessEvent) {
    try {
      await deleteBusinessEvent(event.id, event.imageUrl);
      setConfirmDelete(null);
      setFeedback({ msg: "Event deleted.", tone: "success" });
    } catch (err) {
      setFeedback({ msg: formatFirebaseError(err), tone: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-line bg-panel/80 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Events
          </p>
          <p className="mt-1 text-sm text-stone-400">
            Publish events with free RSVP or paid ticket options.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accentSoft"
        >
          + Add event
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-panel/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
          Share & embed
        </p>
        <p className="mt-2 text-sm leading-7 text-stone-300">
          Solidarity Circle members can publish events here and reuse them on
          their own websites or calendars.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            ["Direct link", eventPageUrl],
            ["Iframe embed", iframeSnippet],
            ["ICS subscription", icsUrl]
          ].map(([label, value]) => (
            <div key={label}>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                {label}
              </label>
              <textarea
                readOnly
                value={value}
                rows={3}
                className="w-full resize-none rounded-xl border border-line bg-canvas/60 px-3 py-2 text-xs text-stone-200"
              />
            </div>
          ))}
        </div>
      </div>

      {feedback ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border border-success/35 bg-success/10 text-stone-100"
              : "border border-danger/35 bg-danger/10 text-rose-300"
          }`}
        >
          {feedback.msg}
        </div>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-accent/30 bg-panel/80 p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-stone-400">
                Event title <span className="text-accent">*</span>
              </label>
              <input
                required
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400">
                Status
              </label>
              <select
                value={form.status}
                onChange={(event) =>
                  updateField("status", event.target.value as BusinessEventFormValues["status"])
                }
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-3 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400">
              Description <span className="text-stone-600">({form.description.length}/1400)</span>
            </label>
            <textarea
              rows={4}
              maxLength={1400}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-stone-400">
                Start
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => updateField("startsAt", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400">
                End
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => updateField("endsAt", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-stone-400">
                Venue
              </label>
              <input
                value={form.venueName}
                onChange={(event) => updateField("venueName", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400">
                Address
              </label>
              <input
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-canvas/60 px-4 py-2.5 text-sm text-ink focus:border-accent/60 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400">
              Event image
            </label>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {form.imageUrl ? (
                <div className="relative h-24 w-36 overflow-hidden rounded-xl border border-line">
                  <Image
                    src={form.imageUrl}
                    alt="Event image"
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-line bg-panelAlt/60 px-4 py-2 text-sm text-stone-300 transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
              >
                {uploading ? "Uploading..." : form.imageUrl ? "Replace image" : "Upload image"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-line bg-canvas/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Tickets
              </p>
              <button
                type="button"
                onClick={() =>
                  updateField("ticketTypes", [
                    ...form.ticketTypes,
                    { ...EMPTY_TICKET, id: `ticket-${Date.now()}` }
                  ])
                }
                className="rounded-full border border-line px-3 py-1.5 text-xs text-stone-300 transition hover:border-accent/40 hover:text-ink"
              >
                Add ticket
              </button>
            </div>

            {form.ticketTypes.map((ticket, index) => (
              <div key={`${ticket.id}-${index}`} className="grid gap-3 rounded-xl border border-line bg-panelAlt/50 p-3 sm:grid-cols-[1fr_110px_110px_auto]">
                <input
                  value={ticket.name}
                  onChange={(event) => updateTicket(index, { name: event.target.value })}
                  placeholder="Ticket name"
                  className="rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ticket.priceCents === 0 ? "" : (ticket.priceCents / 100).toFixed(2)}
                  onChange={(event) =>
                    updateTicket(index, {
                      priceCents: Math.round((parseFloat(event.target.value) || 0) * 100)
                    })
                  }
                  placeholder="Free"
                  className="rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  value={ticket.quantityTotal || ""}
                  onChange={(event) =>
                    updateTicket(index, {
                      quantityTotal: Math.max(0, Math.round(Number(event.target.value) || 0))
                    })
                  }
                  placeholder="Qty"
                  className="rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateField(
                      "ticketTypes",
                      form.ticketTypes.filter((_, ticketIndex) => ticketIndex !== index)
                    )
                  }
                  className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-danger/20"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
            >
              {saving ? "Saving..." : editing ? "Save event" : "Create event"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-stone-300 transition hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {confirmDelete ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
          <p className="font-medium text-stone-100">
            Delete &ldquo;{confirmDelete.title}&rdquo;?
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => handleDelete(confirmDelete)}
              className="rounded-full border border-danger bg-danger/20 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-danger/30"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="rounded-full border border-line px-4 py-2 text-sm text-stone-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl border border-line bg-panel/60" />
      ) : error ? (
        <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : events.length ? (
        <div className="space-y-3">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onEdit={openEdit}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-canvas/30 px-6 py-10 text-center">
          <p className="font-display text-lg font-bold text-ink">No events yet</p>
          <p className="mt-1 text-sm text-stone-400">
            Create your first event with a free RSVP or paid ticket.
          </p>
        </div>
      )}
    </div>
  );
}
