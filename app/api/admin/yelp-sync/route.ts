import { NextRequest, NextResponse } from "next/server";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { normalizeBusinessRecord } from "@/lib/businesses";
import { normalizeCapabilities } from "@/lib/user-capabilities";

type YelpBusinessDetail = {
  id?: string;
  alias?: string;
  name?: string;
  url?: string;
  image_url?: string;
  photos?: string[];
  rating?: number;
  review_count?: number;
  hours?: Array<{
    open?: Array<{
      day?: number;
      start?: string;
      end?: string;
      is_overnight?: boolean;
    }>;
  }>;
};

type YelpReviewResponse = {
  reviews?: Array<{
    id?: string;
    rating?: number;
    text?: string;
    url?: string;
    time_created?: string;
    user?: {
      name?: string;
      image_url?: string;
    };
  }>;
};

type YelpSearchResponse = {
  businesses?: Array<{
    id?: string;
    alias?: string;
  }>;
};

function getAdminApp() {
  if (getApps().length) return getApp();

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

async function getVerifiedAdmin(req: NextRequest) {
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
    const userData = userSnapshot.data() ?? {};
    const hasAdminAccess =
      decodedToken.admin === true ||
      userData.role === "admin" ||
      normalizeCapabilities(userData.capabilities).includes("admin");

    return hasAdminAccess ? { db } : null;
  } catch {
    return null;
  }
}

function getYelpApiKey() {
  return (
    process.env.YELP_API_KEY ??
    process.env.YELP_FUSION_API_KEY ??
    process.env.YEL_API_KEY ??
    ""
  );
}

async function fetchYelp<T>(path: string, apiKey: string) {
  const response = await fetch(`https://api.yelp.com/v3${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Yelp request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function normalizeIdentifier(value: string) {
  return encodeURIComponent(value.trim());
}

function buildSearchPath(name: string, address: string) {
  const params = new URLSearchParams({
    term: name,
    location: address || "Milwaukee, WI",
    limit: "1",
    sort_by: "best_match"
  });

  return `/businesses/search?${params.toString()}`;
}

function normalizeYelpHours(detail: YelpBusinessDetail) {
  return (detail.hours ?? [])
    .flatMap((hoursBlock) => hoursBlock.open ?? [])
    .map((period) => ({
      day: typeof period.day === "number" ? period.day : 0,
      start: period.start ?? "",
      end: period.end ?? "",
      isOvernight: Boolean(period.is_overnight)
    }))
    .filter((period) => period.start && period.end);
}

function normalizeYelpReviews(response: YelpReviewResponse | null) {
  return (response?.reviews ?? [])
    .map((review) => ({
      id: review.id ?? "",
      rating: typeof review.rating === "number" ? review.rating : null,
      text: review.text ?? "",
      url: review.url ?? "",
      timeCreated: review.time_created ?? "",
      userName: review.user?.name ?? "",
      userImageUrl: review.user?.image_url ?? ""
    }))
    .filter((review) => review.id || review.text);
}

export async function POST(req: NextRequest) {
  const context = await getVerifiedAdmin(req);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = getYelpApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "YELP_API_KEY, YELP_FUSION_API_KEY, or YEL_API_KEY is not configured." },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  const requestedYelpBusinessId =
    typeof body.yelpBusinessId === "string" ? body.yelpBusinessId.trim() : "";
  const requestedYelpAlias =
    typeof body.yelpAlias === "string" ? body.yelpAlias.trim() : "";

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required." }, { status: 400 });
  }

  const businessRef = context.db.collection("businesses").doc(businessId);
  const businessSnapshot = await businessRef.get();

  if (!businessSnapshot.exists) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const business = normalizeBusinessRecord(businessSnapshot.data(), businessSnapshot.id);
  let yelpIdentifier =
    requestedYelpBusinessId ||
    requestedYelpAlias ||
    business.yelpBusinessId ||
    business.yelpAlias;

  if (!yelpIdentifier) {
    const search = await fetchYelp<YelpSearchResponse>(
      buildSearchPath(business.name, business.address),
      apiKey
    );
    const match = search.businesses?.[0];
    yelpIdentifier = match?.id || match?.alias || "";
  }

  if (!yelpIdentifier) {
    await businessRef.set(
      {
        yelpLastSyncError: "No Yelp match found.",
        yelpLastSyncedAt: Timestamp.now()
      },
      { merge: true }
    );

    return NextResponse.json({ error: "No Yelp match found." }, { status: 404 });
  }

  const detail = await fetchYelp<YelpBusinessDetail>(
    `/businesses/${normalizeIdentifier(yelpIdentifier)}`,
    apiKey
  );

  let reviewError = "";
  let reviewResponse: YelpReviewResponse | null = null;

  try {
    reviewResponse = await fetchYelp<YelpReviewResponse>(
      `/businesses/${normalizeIdentifier(detail.id || yelpIdentifier)}/reviews`,
      apiKey
    );
  } catch (error) {
    reviewError =
      error instanceof Error
        ? error.message
        : "Yelp review excerpt request failed.";
  }

  const yelpPhotos = Array.from(
    new Set([detail.image_url, ...(detail.photos ?? [])].filter(Boolean))
  );
  const update = {
    yelpBusinessId: detail.id ?? requestedYelpBusinessId ?? business.yelpBusinessId,
    yelpAlias: detail.alias ?? requestedYelpAlias ?? business.yelpAlias,
    yelpUrl: detail.url ?? "",
    yelpRating: typeof detail.rating === "number" ? detail.rating : null,
    yelpReviewCount:
      typeof detail.review_count === "number" ? detail.review_count : null,
    yelpPhotos,
    yelpHours: normalizeYelpHours(detail),
    yelpReviews: normalizeYelpReviews(reviewResponse),
    yelpLastSyncedAt: Timestamp.now(),
    yelpLastSyncError: reviewError
  };

  await businessRef.set(update, { merge: true });

  return NextResponse.json({
    success: true,
    businessId,
    yelpBusinessId: update.yelpBusinessId,
    yelpAlias: update.yelpAlias,
    photoCount: update.yelpPhotos.length,
    reviewCount: update.yelpReviews.length,
    reviewError: reviewError || null
  });
}
