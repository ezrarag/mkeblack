import { NextResponse } from "next/server";
import { trackBusinessAnalytics } from "@/lib/analytics";

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const businessId =
    typeof payload?.businessId === "string" ? payload.businessId.trim() : "";
  const eventType = payload?.eventType;

  if (!businessId) {
    return NextResponse.json(
      { error: "businessId is required." },
      { status: 400 }
    );
  }

  if (eventType !== "profile_view" && eventType !== "link_click") {
    return NextResponse.json(
      { error: "eventType must be profile_view or link_click." },
      { status: 400 }
    );
  }

  try {
    await trackBusinessAnalytics({
      businessId,
      eventType,
      regionBucket: asOptionalString(payload?.regionBucket),
      referralSource: asOptionalString(payload?.referralSource),
      ageBucket: asOptionalString(payload?.ageBucket),
      interestBuckets: asStringArray(payload?.interestBuckets),
      linkTarget: asOptionalString(payload?.linkTarget),
      periodKey: asOptionalString(payload?.periodKey)
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analytics could not be recorded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
