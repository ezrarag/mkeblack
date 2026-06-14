import { NextRequest, NextResponse } from "next/server";
import {
  getPublicEventsForBusiness,
  publicCorsHeaders
} from "@/lib/events-public";

export async function OPTIONS() {
  return new NextResponse(null, { headers: publicCorsHeaders() });
}

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId")?.trim();

  if (!businessId) {
    return NextResponse.json(
      { error: "businessId is required." },
      { status: 400, headers: publicCorsHeaders() }
    );
  }

  const events = await getPublicEventsForBusiness(
    businessId,
    request.nextUrl.origin
  );

  return NextResponse.json(events, { headers: publicCorsHeaders() });
}
