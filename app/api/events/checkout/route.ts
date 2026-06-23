import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { isEventPast } from "@/lib/events";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { getBaseUrl, getStripe } from "@/lib/stripe/server";

type TicketRecord = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  active: boolean;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(10, Math.max(1, Math.round(value)));
}

function normalizeTickets(value: unknown): TicketRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => {
      return typeof item === "object" && item !== null && !Array.isArray(item);
    })
    .map((item) => ({
      id: getString(item.id),
      name: getString(item.name) || "General admission",
      description: getString(item.description),
      priceCents:
        typeof item.priceCents === "number" && Number.isFinite(item.priceCents)
          ? Math.max(0, Math.round(item.priceCents))
          : 0,
      quantityTotal:
        typeof item.quantityTotal === "number" && Number.isFinite(item.quantityTotal)
          ? Math.max(0, Math.round(item.quantityTotal))
          : 0,
      quantitySold:
        typeof item.quantitySold === "number" && Number.isFinite(item.quantitySold)
          ? Math.max(0, Math.round(item.quantitySold))
          : 0,
      active: item.active !== false
    }));
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  let body: {
    eventId?: string;
    ticketTypeId?: string;
    customerName?: string;
    customerEmail?: string;
    quantity?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const eventId = getString(body.eventId);
  const ticketTypeId = getString(body.ticketTypeId);
  const customerName = getString(body.customerName);
  const customerEmail = getString(body.customerEmail).toLowerCase();
  const quantity = getQuantity(body.quantity);

  if (!eventId || !ticketTypeId || !customerName || !customerEmail) {
    return NextResponse.json(
      { error: "Event, ticket, name, and email are required." },
      { status: 400 }
    );
  }

  try {
    const db = getFirebaseAdminDb();
    const eventRef = db.collection("events").doc(eventId);
    const orderRef = db.collection("event_ticket_orders").doc();
    let ticket: TicketRecord | null = null;
    let eventTitle = "";
    let businessId = "";
    let businessName = "";

    await db.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      if (!eventSnapshot.exists) {
        throw new HttpError(404, "Event not found.");
      }

      const eventData = eventSnapshot.data() ?? {};
      if (eventData.status !== "published") {
        throw new HttpError(400, "This event is not accepting tickets yet.");
      }

      if (
        isEventPast({
          startsAt: parseDateValue(eventData.startsAt),
          endsAt: parseDateValue(eventData.endsAt)
        })
      ) {
        throw new HttpError(
          400,
          "This event has ended and is no longer accepting RSVPs."
        );
      }

      const tickets = normalizeTickets(eventData.ticketTypes);
      const selectedTicket = tickets.find((candidate) => candidate.id === ticketTypeId);
      if (!selectedTicket?.active) {
        throw new HttpError(400, "This ticket is not available.");
      }

      const remaining =
        selectedTicket.quantityTotal > 0
          ? selectedTicket.quantityTotal - selectedTicket.quantitySold
          : Number.MAX_SAFE_INTEGER;

      if (remaining < quantity) {
        throw new HttpError(400, "Not enough tickets remain.");
      }

      ticket = selectedTicket;
      eventTitle = getString(eventData.title);
      businessId = getString(eventData.businessId);
      businessName = getString(eventData.businessName);

      const nextTickets = tickets.map((candidate) =>
        candidate.id === selectedTicket.id
          ? {
              ...candidate,
              quantitySold: candidate.quantitySold + quantity
            }
          : candidate
      );

      transaction.update(eventRef, {
        ticketTypes: nextTickets,
        updatedAt: FieldValue.serverTimestamp()
      });

      transaction.set(orderRef, {
        id: orderRef.id,
        eventId,
        eventTitle,
        businessId,
        businessName,
        ticketTypeId,
        ticketName: selectedTicket.name,
        quantity,
        customerName,
        customerEmail,
        amountCents: selectedTicket.priceCents * quantity,
        status: selectedTicket.priceCents > 0 ? "pending" : "free",
        stripeCheckoutSessionId: "",
        createdAt: FieldValue.serverTimestamp(),
        paidAt: null
      });
    });

    const ticketForCheckout = ticket as TicketRecord | null;

    if (!ticketForCheckout) {
      throw new Error("Ticket not found.");
    }

    if (ticketForCheckout.priceCents === 0) {
      return NextResponse.json({ success: true, orderId: orderRef.id });
    }

    const stripe = getStripe();
    const baseUrl = getBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: ticketForCheckout.priceCents,
            product_data: {
              name: `${eventTitle} - ${ticketForCheckout.name}`,
              description: businessName || undefined
            }
          }
        }
      ],
      customer_email: customerEmail,
      client_reference_id: orderRef.id,
      metadata: {
        kind: "event_ticket",
        orderId: orderRef.id,
        eventId,
        ticketTypeId,
        businessId,
        customerName,
        customerEmail
      },
      success_url: `${baseUrl}/events?ticket=success`,
      cancel_url: `${baseUrl}/events?ticket=cancelled`
    });

    await orderRef.update({
      stripeCheckoutSessionId: session.id
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to start checkout.";
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
