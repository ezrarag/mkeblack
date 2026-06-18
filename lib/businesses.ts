import {
  Business,
  BusinessClaimInvite,
  BusinessFormValues,
  BusinessSource,
  HoursSource,
  ClaimInviteStatus
} from "@/lib/types";
import {
  BUSINESS_CATEGORIES,
  MILWAUKEE_CENTER,
  createClosedBusinessHours,
  createEmptyBusinessForm
} from "@/lib/constants";
import { normalizeUrl } from "@/lib/utils";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isDefaultMapLocation(location: { lat: number; lng: number }) {
  return (
    Math.abs(location.lat - MILWAUKEE_CENTER.lat) < 0.000001 &&
    Math.abs(location.lng - MILWAUKEE_CENTER.lng) < 0.000001
  );
}

function normalizeGeocodingStatus(value: unknown) {
  if (
    value === "verified" ||
    value === "manual" ||
    value === "failed" ||
    value === "needs_geocode"
  ) {
    return value;
  }

  return null;
}

/**
 * Some imported records still carry the raw Wix export format, where
 * category arrives as a JSON-array string e.g. '["Food & Drink"]' or
 * even '["Nonprofits","Event Venues & Working Spaces"]'. Clean that up
 * to a single, plain category label so the directory's category list
 * doesn't show duplicate/garbled entries alongside the real labels.
 */
function normalizeCategoryValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("[")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return String(parsed[0]).trim();
    }
  } catch {
    // Not valid JSON — fall through to manual cleanup
  }

  return (
    trimmed
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")[0]
      ?.replace(/^"+|"+$/g, "")
      .trim() ?? trimmed
  );
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  if (
    isRecord(value) &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsedDate = value.toDate();
    return parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())
      ? parsedDate
      : null;
  }

  return null;
}

function stringArrayValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeYelpReviews(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((review) => ({
      id: stringValue(review.id).trim(),
      rating: nullableNumberValue(review.rating),
      text: stringValue(review.text).trim(),
      url: normalizeUrl(stringValue(review.url).trim()),
      timeCreated: stringValue(review.timeCreated).trim(),
      userName: stringValue(review.userName).trim(),
      userImageUrl: normalizeUrl(stringValue(review.userImageUrl).trim())
    }))
    .filter((review) => review.id || review.text);
}

function normalizeYelpHours(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((period) => ({
      day: numberValue(period.day, 0),
      start: stringValue(period.start).trim(),
      end: stringValue(period.end).trim(),
      isOvernight: booleanValue(period.isOvernight, false)
    }))
    .filter((period) => period.start && period.end);
}

function normalizeHours(value: unknown) {
  const defaultHours = createClosedBusinessHours();

  if (!isRecord(value)) {
    return defaultHours;
  }

  return {
    monday: {
      open: stringValue(isRecord(value.monday) ? value.monday.open : undefined, defaultHours.monday.open),
      close: stringValue(isRecord(value.monday) ? value.monday.close : undefined, defaultHours.monday.close),
      closed: booleanValue(
        isRecord(value.monday) ? value.monday.closed : undefined,
        defaultHours.monday.closed
      )
    },
    tuesday: {
      open: stringValue(isRecord(value.tuesday) ? value.tuesday.open : undefined, defaultHours.tuesday.open),
      close: stringValue(isRecord(value.tuesday) ? value.tuesday.close : undefined, defaultHours.tuesday.close),
      closed: booleanValue(
        isRecord(value.tuesday) ? value.tuesday.closed : undefined,
        defaultHours.tuesday.closed
      )
    },
    wednesday: {
      open: stringValue(isRecord(value.wednesday) ? value.wednesday.open : undefined, defaultHours.wednesday.open),
      close: stringValue(isRecord(value.wednesday) ? value.wednesday.close : undefined, defaultHours.wednesday.close),
      closed: booleanValue(
        isRecord(value.wednesday) ? value.wednesday.closed : undefined,
        defaultHours.wednesday.closed
      )
    },
    thursday: {
      open: stringValue(isRecord(value.thursday) ? value.thursday.open : undefined, defaultHours.thursday.open),
      close: stringValue(isRecord(value.thursday) ? value.thursday.close : undefined, defaultHours.thursday.close),
      closed: booleanValue(
        isRecord(value.thursday) ? value.thursday.closed : undefined,
        defaultHours.thursday.closed
      )
    },
    friday: {
      open: stringValue(isRecord(value.friday) ? value.friday.open : undefined, defaultHours.friday.open),
      close: stringValue(isRecord(value.friday) ? value.friday.close : undefined, defaultHours.friday.close),
      closed: booleanValue(
        isRecord(value.friday) ? value.friday.closed : undefined,
        defaultHours.friday.closed
      )
    },
    saturday: {
      open: stringValue(isRecord(value.saturday) ? value.saturday.open : undefined, defaultHours.saturday.open),
      close: stringValue(isRecord(value.saturday) ? value.saturday.close : undefined, defaultHours.saturday.close),
      closed: booleanValue(
        isRecord(value.saturday) ? value.saturday.closed : undefined,
        defaultHours.saturday.closed
      )
    },
    sunday: {
      open: stringValue(isRecord(value.sunday) ? value.sunday.open : undefined, defaultHours.sunday.open),
      close: stringValue(isRecord(value.sunday) ? value.sunday.close : undefined, defaultHours.sunday.close),
      closed: booleanValue(
        isRecord(value.sunday) ? value.sunday.closed : undefined,
        defaultHours.sunday.closed
      )
    }
  };
}

export function getBusinessSourceLabel(source: BusinessSource) {
  switch (source) {
    case "import":
      return "Import";
    case "manual":
      return "Manual";
    case "self-submitted":
      return "Self-submitted";
  }
}

export function getBusinessSourceBadgeClass(source: BusinessSource) {
  switch (source) {
    case "import":
      return "border border-accent/35 bg-accent/10 text-accentSoft";
    case "manual":
      return "border border-line bg-panelAlt/70 text-stone-200";
    case "self-submitted":
      return "border border-success/35 bg-success/10 text-success";
  }
}

export function normalizeBusinessSource(
  value: unknown,
  ownerUid: string | null
): BusinessSource {
  if (
    value === "import" ||
    value === "manual" ||
    value === "self-submitted"
  ) {
    return value;
  }

  return ownerUid ? "self-submitted" : "manual";
}

export function normalizeClaimInviteStatus(value: unknown): ClaimInviteStatus {
  if (value === "pending" || value === "claimed" || value === "not_invited") {
    return value;
  }

  return "not_invited";
}

function normalizeHoursSource(value: unknown): HoursSource | null {
  if (
    value === "manual" ||
    value === "google_places" ||
    value === "imported_text"
  ) {
    return value;
  }

  return null;
}

export function normalizeBusinessRecord(value: unknown, id: string): Business {
  const record = isRecord(value) ? value : {};
  const ownerUid = stringValue(record.ownerUid).trim() || null;
  const source = normalizeBusinessSource(record.source, ownerUid);
  const location = {
    lat: numberValue(
      isRecord(record.location) ? record.location.lat : undefined,
      MILWAUKEE_CENTER.lat
    ),
    lng: numberValue(
      isRecord(record.location) ? record.location.lng : undefined,
      MILWAUKEE_CENTER.lng
    )
  };
  const inferredLocationVerified = !isDefaultMapLocation(location);
  const locationVerified = booleanValue(
    record.locationVerified,
    inferredLocationVerified
  );
  const normalizedGeocodingStatus = normalizeGeocodingStatus(
    record.geocodingStatus
  );

  return {
    id,
    name: stringValue(record.name).trim(),
    category:
      normalizeCategoryValue(stringValue(record.category)) || BUSINESS_CATEGORIES[0],
    description: stringValue(record.description).trim(),
    address: stringValue(record.address).trim(),
    phone: stringValue(record.phone).trim(),
    website: normalizeUrl(stringValue(record.website).trim()),
    instagramReelUrl: normalizeUrl(stringValue(record.instagramReelUrl).trim()),
    email: stringValue(record.email).trim(),
    hoursText: stringValue(record.hoursText),
    neighborhood: stringValue(record.neighborhood).trim(),
    tags: stringArrayValue(record.tags),
    hours: normalizeHours(record.hours),
    hoursSource: normalizeHoursSource(record.hoursSource),
    hoursSkipped: booleanValue(record.hoursSkipped, false),
    hoursLastSynced: parseDateValue(record.hoursLastSynced),
    photos: Array.isArray(record.photos)
      ? record.photos.filter((photo): photo is string => typeof photo === "string")
      : [],
    ownerUid,
    active: booleanValue(record.active, true),
    hasTeamProfiles: booleanValue(record.hasTeamProfiles, false),
    source,
    importedAt: parseDateValue(record.importedAt),
    claimInviteStatus: normalizeClaimInviteStatus(record.claimInviteStatus),
    claimInvitedAt: parseDateValue(record.claimInvitedAt),
    googlePlaceId: stringValue(record.googlePlaceId).trim(),
    googleMatchedName: stringValue(record.googleMatchedName).trim(),
    googleMapsUrl: normalizeUrl(stringValue(record.googleMapsUrl).trim()),
    googleProfileLastSynced: parseDateValue(record.googleProfileLastSynced),
    yelpBusinessId: stringValue(record.yelpBusinessId).trim(),
    yelpAlias: stringValue(record.yelpAlias).trim(),
    yelpUrl: normalizeUrl(stringValue(record.yelpUrl).trim()),
    yelpRating: nullableNumberValue(record.yelpRating),
    yelpReviewCount: nullableNumberValue(record.yelpReviewCount),
    yelpPhotos: stringArrayValue(record.yelpPhotos),
    yelpReviews: normalizeYelpReviews(record.yelpReviews),
    yelpHours: normalizeYelpHours(record.yelpHours),
    yelpLastSyncedAt: parseDateValue(record.yelpLastSyncedAt),
    yelpLastSyncError: stringValue(record.yelpLastSyncError).trim(),
    location,
    locationVerified,
    geocodingStatus:
      normalizedGeocodingStatus ??
      (locationVerified ? "verified" : record.address ? "failed" : "needs_geocode"),
    onlineBased: booleanValue(record.onlineBased, false),
    solidarityMember: booleanValue(record.solidarityMember, false),
    solidarityMemberSince: parseDateValue(record.solidarityMemberSince),
    solidarityMemberExpiry: parseDateValue(record.solidarityMemberExpiry),
    solidarityMembershipSource:
      record.solidarityMembershipSource === "manual" ||
      record.solidarityMembershipSource === "comp"
        ? record.solidarityMembershipSource
        : "stripe",
    solidarityMembershipNotes: stringValue(record.solidarityMembershipNotes).trim()
  };
}

export function businessToFormValues(business: Business): BusinessFormValues {
  return {
    name: business.name,
    category: business.category,
    description: business.description,
    address: business.address,
    phone: business.phone,
    website: business.website,
    instagramReelUrl: business.instagramReelUrl,
    email: business.email,
    hoursText: business.hoursText,
    neighborhood: business.neighborhood,
    tags: [...business.tags],
    hours: normalizeHours(business.hours),
    photos: [...business.photos],
    ownerUid: business.ownerUid ?? "",
    active: business.active,
    onlineBased: business.onlineBased,
    source: business.source,
    yelpBusinessId: business.yelpBusinessId,
    yelpAlias: business.yelpAlias,
    location: { ...business.location }
  };
}

export function createImportedBusinessFormDraft(
  partialValues?: Partial<BusinessFormValues>
): BusinessFormValues {
  return {
    ...createEmptyBusinessForm(),
    hours: createClosedBusinessHours(),
    source: "import",
    ...partialValues
  };
}

export function createBusinessDuplicateKey(name: string, address: string) {
  return `${name.trim().toLowerCase()}::${address.trim().toLowerCase()}`;
}

export function normalizeBusinessClaimInvite(
  value: unknown,
  id: string
): BusinessClaimInvite {
  const record = isRecord(value) ? value : {};

  return {
    id,
    businessId: stringValue(record.businessId).trim() || id,
    businessName: stringValue(record.businessName).trim(),
    email: stringValue(record.email).trim(),
    status: record.status === "claimed" ? "claimed" : "pending",
    createdAt: parseDateValue(record.createdAt),
    claimedAt: parseDateValue(record.claimedAt),
    claimedByUid: stringValue(record.claimedByUid).trim() || null
  };
}
