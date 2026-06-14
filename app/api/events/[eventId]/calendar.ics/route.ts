import { NextRequest, NextResponse } from "next/server";
import {
  getPublicEventsForBusiness,
  publicCorsHeaders
} from "@/lib/events-public";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(value: string | null) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: publicCorsHeaders() });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const businessId = params.eventId;
  const events = await getPublicEventsForBusiness(
    businessId,
    request.nextUrl.origin
  );
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MKE Black//Business Events//EN",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.id}@mkeblack.org`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(event.date)}`,
      `DTEND:${formatIcsDate(event.endDate ?? event.date)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      `LOCATION:${escapeIcs(event.address)}`,
      `URL:${escapeIcs(event.ticketUrl)}`,
      "END:VEVENT"
    ]),
    "END:VCALENDAR"
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      ...publicCorsHeaders(),
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${businessId}-events.ics"`
    }
  });
}
