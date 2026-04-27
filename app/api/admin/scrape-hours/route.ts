import { NextRequest, NextResponse } from "next/server";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { normalizeBusinessRecord } from "@/lib/businesses";
import { createClosedBusinessHours } from "@/lib/constants";
import {
  formatReadableHours,
  isBusinessEligibleForHoursSync,
  normalizeAdminSyncSessionRecord,
  parseGooglePlacesPeriods
} from "@/lib/hours-sync";
import { AdminHoursSyncResult, BusinessHours } from "@/lib/types";

const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 60_000;

function getAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const privateKey = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: privateKey!
    })
  });
}

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

async function verifyAdmin(req: NextRequest) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const hasAdminAccess =
      decodedToken.admin === true || userSnapshot.data()?.role === "admin";

    return hasAdminAccess ? { db, decodedToken } : null;
  } catch {
    return null;
  }
}

function buildPlacesFindUrl(input: string) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
  );
  url.searchParams.set("input", input);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id,name");
  url.searchParams.set("key", process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "");
  return url.toString();
}

function buildPlacesDetailsUrl(placeId: string) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json"
  );
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "opening_hours");
  url.searchParams.set("key", process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "");
  return url.toString();
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Google Places request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function scrapeBusinessHours(businessId: string, name: string, address: string) {
  const searchInput = `${name} ${address} Milwaukee`;
  const searchResponse = await fetchJson<{
    candidates?: Array<{ place_id?: string; name?: string }>;
    status?: string;
  }>(buildPlacesFindUrl(searchInput));

  const candidate = searchResponse.candidates?.[0];

  if (!candidate?.place_id) {
    return {
      businessId,
      businessName: name,
      address,
      placeId: null,
      matchedName: "",
      proposedHours: null,
      status: "not_found" as const,
      message: "Not found on Google Places.",
      reviewedAt: null
    };
  }

  const detailsResponse = await fetchJson<{
    result?: {
      opening_hours?: {
        periods?: unknown;
      };
    };
    status?: string;
  }>(buildPlacesDetailsUrl(candidate.place_id));

  const proposedHours = parseGooglePlacesPeriods(
    detailsResponse.result?.opening_hours?.periods
  );

  if (!proposedHours) {
    return {
      businessId,
      businessName: name,
      address,
      placeId: candidate.place_id,
      matchedName: candidate.name ?? "",
      proposedHours: null,
      status: "not_found" as const,
      message: "Google Places returned no structured opening hours.",
      reviewedAt: null
    };
  }

  return {
    businessId,
    businessName: name,
    address,
    placeId: candidate.place_id,
    matchedName: candidate.name ?? "",
    proposedHours,
    status: "found" as const,
    message: `Found on Google Places: ${formatReadableHours(proposedHours)}`,
    reviewedAt: null
  };
}

function nowTimestamp() {
  return Timestamp.now();
}

function normalizeSubmittedHours(value: unknown): BusinessHours | null {
  const empty = createClosedBusinessHours();

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const submitted = value as Record<string, unknown>;
  const hours = createClosedBusinessHours();

  for (const day of Object.keys(empty) as Array<keyof BusinessHours>) {
    const dayValue = submitted[day];

    if (typeof dayValue !== "object" || dayValue === null || Array.isArray(dayValue)) {
      return null;
    }

    const candidate = dayValue as Record<string, unknown>;
    const open = typeof candidate.open === "string" ? candidate.open : empty[day].open;
    const close = typeof candidate.close === "string" ? candidate.close : empty[day].close;
    const closed =
      typeof candidate.closed === "boolean" ? candidate.closed : empty[day].closed;

    hours[day] = { open, close, closed };
  }

  return hours;
}

export async function POST(req: NextRequest) {
  const context = await verifyAdmin(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const { db } = context;

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured." },
      { status: 500 }
    );
  }

  if (action === "start") {
    const businessesSnapshot = await db.collection("businesses").get();
    const candidates = businessesSnapshot.docs
      .map((document) => normalizeBusinessRecord(document.data(), document.id))
      .filter((business) => isBusinessEligibleForHoursSync(business));

    const sessionRef = db.collection("admin_sync_sessions").doc();
    const now = nowTimestamp();

    await sessionRef.set({
      status: candidates.length ? "running" : "completed",
      processed: 0,
      total: candidates.length,
      candidateBusinessIds: candidates.map((business) => business.id),
      results: [],
      startedAt: now,
      updatedAt: now,
      lastBatchAt: null
    });

    return NextResponse.json({
      sessionId: sessionRef.id,
      total: candidates.length
    });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  const sessionRef = db.collection("admin_sync_sessions").doc(sessionId);
  const sessionSnapshot = await sessionRef.get();

  if (!sessionSnapshot.exists) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const session = normalizeAdminSyncSessionRecord(
    sessionSnapshot.data(),
    sessionSnapshot.id
  );

  if (action === "process") {
    if (session.status === "completed" || session.processed >= session.total) {
      return NextResponse.json({
        status: "completed",
        processed: session.processed,
        total: session.total
      });
    }

    if (
      session.lastBatchAt &&
      Date.now() - session.lastBatchAt.getTime() < BATCH_INTERVAL_MS
    ) {
      return NextResponse.json(
        {
          error: "Batch interval not reached yet.",
          retryAfterMs: BATCH_INTERVAL_MS - (Date.now() - session.lastBatchAt.getTime())
        },
        { status: 429 }
      );
    }

    const nextIds = session.candidateBusinessIds.slice(
      session.processed,
      session.processed + BATCH_SIZE
    );

    const businessSnapshots = await Promise.all(
      nextIds.map((businessId) => db.collection("businesses").doc(businessId).get())
    );

    const nextResults: AdminHoursSyncResult[] = [];

    for (const businessSnapshot of businessSnapshots) {
      if (!businessSnapshot.exists) {
        nextResults.push({
          businessId: businessSnapshot.id,
          businessName: "",
          address: "",
          placeId: null,
          matchedName: "",
          proposedHours: null,
          status: "error",
          message: "Business no longer exists.",
          reviewedAt: null
        });
        continue;
      }

      const business = normalizeBusinessRecord(
        businessSnapshot.data(),
        businessSnapshot.id
      );

      try {
        nextResults.push(
          await scrapeBusinessHours(business.id, business.name, business.address)
        );
      } catch (error) {
        nextResults.push({
          businessId: business.id,
          businessName: business.name,
          address: business.address,
          placeId: null,
          matchedName: "",
          proposedHours: null,
          status: "error",
          message: error instanceof Error ? error.message : "Google Places lookup failed.",
          reviewedAt: null
        });
      }
    }

    const processed = session.processed + nextResults.length;
    const nextStatus = processed >= session.total ? "completed" : "running";
    const now = nowTimestamp();

    await sessionRef.set(
      {
        processed,
        status: nextStatus,
        results: [...session.results, ...nextResults],
        updatedAt: now,
        lastBatchAt: now
      },
      { merge: true }
    );

    return NextResponse.json({
      status: nextStatus,
      processed,
      total: session.total,
      added: nextResults.length
    });
  }

  if (action === "approve") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";
    const submittedHours = normalizeSubmittedHours(body.hours);

    if (!businessId || !submittedHours) {
      return NextResponse.json(
        { error: "businessId and hours are required." },
        { status: 400 }
      );
    }

    const now = nowTimestamp();

    await db.collection("businesses").doc(businessId).set(
      {
        hours: submittedHours,
        hoursSource: "google_places",
        hoursSkipped: false,
        hoursLastSynced: now
      },
      { merge: true }
    );

    await sessionRef.set(
      {
        results: session.results.map((result) =>
          result.businessId === businessId
            ? {
                ...result,
                proposedHours: submittedHours,
                status: "approved",
                message: `Approved: ${formatReadableHours(submittedHours)}`,
                reviewedAt: now
              }
            : result
        ),
        updatedAt: now
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  }

  if (action === "skip") {
    const businessId = typeof body.businessId === "string" ? body.businessId : "";

    if (!businessId) {
      return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    }

    const now = nowTimestamp();

    await db.collection("businesses").doc(businessId).set(
      {
        hoursSkipped: true
      },
      { merge: true }
    );

    await sessionRef.set(
      {
        results: session.results.map((result) =>
          result.businessId === businessId
            ? {
                ...result,
                status: "skipped",
                message: "Skipped for future sync runs.",
                reviewedAt: now
              }
            : result
        ),
        updatedAt: now
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
