"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useBusinessEvents } from "@/hooks/use-business-events";
import { BusinessEvent, EventTicketType } from "@/lib/types";

function priceDisplay(cents: number) {
  return cents > 0 ? `$${(cents / 100).toFixed(2)}` : "Free RSVP";
}

function EventTicketForm({
  event,
  ticket
}: {
  event: BusinessEvent;
  ticket: EventTicketType;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/events/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeId: ticket.id,
          customerName,
          customerEmail,
          quantity
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to reserve ticket.");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setCustomerName("");
      setCustomerEmail("");
      setQuantity(1);
      setFeedback("RSVP confirmed. Check your email for details.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Unable to reserve ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  const remaining =
    ticket.quantityTotal > 0
      ? Math.max(0, ticket.quantityTotal - ticket.quantitySold)
      : null;

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-line bg-canvas/50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{ticket.name}</p>
          {ticket.description ? (
            <p className="mt-1 text-xs leading-5 text-stone-400">
              {ticket.description}
            </p>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-accentSoft">
          {priceDisplay(ticket.priceCents)}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_88px]">
        <input
          required
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Name"
          className="rounded-lg border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder:text-stone-500 focus:border-accent/60 focus:outline-none"
        />
        <input
          required
          type="email"
          value={customerEmail}
          onChange={(event) => setCustomerEmail(event.target.value)}
          placeholder="Email"
          className="rounded-lg border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink placeholder:text-stone-500 focus:border-accent/60 focus:outline-none"
        />
        <input
          type="number"
          min="1"
          max={remaining ?? 10}
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.max(1, Math.round(Number(event.target.value) || 1)))
          }
          className="rounded-lg border border-line bg-panelAlt/70 px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          {remaining === null ? "Open capacity" : `${remaining} remaining`}
        </p>
        <button
          type="submit"
          disabled={submitting || remaining === 0}
          className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {submitting
            ? "Working..."
            : ticket.priceCents > 0
              ? "Buy ticket"
              : "Reserve RSVP"}
        </button>
      </div>

      {feedback ? (
        <p className="mt-3 rounded-lg border border-line bg-panelAlt/70 px-3 py-2 text-xs text-stone-300">
          {feedback}
        </p>
      ) : null}
    </form>
  );
}

function EventCard({ event }: { event: BusinessEvent }) {
  const tickets = event.ticketTypes.filter((ticket) => ticket.active);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel/80 shadow-glow">
      {event.imageUrl ? (
        <div className="relative aspect-[16/7] w-full bg-panelAlt">
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes="(min-width: 1024px) 960px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 via-charcoal/40 to-transparent" />
        </div>
      ) : null}

      <div className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {event.businessName}
        </p>
        <h2 className="mt-3 font-display text-3xl font-black text-ink">
          {event.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          {event.description}
        </p>
        <div className="mt-5 grid gap-3 text-sm text-stone-400 sm:grid-cols-2">
          <p>
            <span className="text-stone-500">When:</span>{" "}
            {event.startsAt
              ? event.startsAt.toLocaleString([], {
                  dateStyle: "full",
                  timeStyle: "short"
                })
              : "Date coming soon"}
          </p>
          <p>
            <span className="text-stone-500">Where:</span>{" "}
            {event.venueName || event.address || "Venue coming soon"}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {tickets.length ? (
            tickets.map((ticket) => (
              <EventTicketForm
                key={ticket.id}
                event={event}
                ticket={ticket}
              />
            ))
          ) : (
            <p className="rounded-xl border border-line bg-canvas/40 px-4 py-3 text-sm text-stone-400">
              Ticket details are coming soon.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function EventsPage() {
  const { events, loading, error } = useBusinessEvents({ publishedOnly: true });

  return (
    <main>
      <section className="bg-mesh-dark">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
            Events
          </p>
          <h1 className="mt-4 font-display text-5xl font-black leading-tight text-ink sm:text-6xl">
            Black cultural &amp; business events.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            Discover community gatherings, business workshops, pop-ups, and
            ticketed experiences from MKE Black and Solidarity Circle businesses.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {loading ? (
          <div className="h-56 animate-pulse rounded-2xl border border-line bg-panel/80" />
        ) : error ? (
          <div className="rounded-2xl border border-danger/35 bg-danger/10 p-8 text-rose-300">
            {error}
          </div>
        ) : events.length ? (
          <div className="space-y-8">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-panel/80 p-12 text-center">
            <p className="font-display text-2xl font-bold text-ink">
              No events at the moment.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-400">
              Check back soon for community gatherings, business mixers, and
              cultural celebrations throughout Milwaukee.
            </p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-8 text-center">
          <p className="font-display text-xl font-bold text-ink">
            Hosting something?
          </p>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Solidarity Circle members can add events from the owner dashboard.
            Other organizers can send details through the contact form.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard?tab=events"
              className="inline-flex rounded-full border border-accent bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              Submit your event
            </Link>
            <Link
              href="/contact?reason=event"
              className="inline-flex rounded-full border border-line px-6 py-3 text-sm font-medium text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
            >
              Contact MKE Black
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
