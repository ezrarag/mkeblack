import { NextRequest, NextResponse } from "next/server";
import { getPublicEvent, publicCorsHeaders } from "@/lib/events-public";

export async function OPTIONS() {
  return new NextResponse(null, { headers: publicCorsHeaders() });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const event = await getPublicEvent(params.eventId, request.nextUrl.origin);

  if (!event) {
    return NextResponse.json(
      { error: "Event not found." },
      { status: 404, headers: publicCorsHeaders() }
    );
  }

  return NextResponse.json(event, { headers: publicCorsHeaders() });
}
