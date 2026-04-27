import { createClosedBusinessHours } from "@/lib/constants";
import { formatTime } from "@/lib/business-hours";
import {
  AdminHoursSyncResult,
  AdminHoursSyncResultStatus,
  AdminSyncSession,
  AdminSyncSessionStatus,
  Business,
  BusinessHours,
  DAY_KEYS,
  DayKey
} from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

const GOOGLE_DAY_TO_KEY: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

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

function normalizeHours(value: unknown): BusinessHours {
  const defaultHours = createClosedBusinessHours();

  if (!isRecord(value)) {
    return defaultHours;
  }

  return DAY_KEYS.reduce((hours, day) => {
    const dayValue = isRecord(value[day]) ? value[day] : {};
    hours[day] = {
      open: stringValue(isRecord(dayValue) ? dayValue.open : undefined, defaultHours[day].open),
      close: stringValue(isRecord(dayValue) ? dayValue.close : undefined, defaultHours[day].close),
      closed: booleanValue(
        isRecord(dayValue) ? dayValue.closed : undefined,
        defaultHours[day].closed
      )
    };

    return hours;
  }, createClosedBusinessHours());
}

export function hasNoStructuredHours(hours: BusinessHours) {
  return DAY_KEYS.every((day) => hours[day].closed);
}

export function isBusinessEligibleForHoursSync(
  business: Pick<Business, "source" | "hours" | "hoursSkipped">
) {
  return business.source === "import" && !business.hoursSkipped && hasNoStructuredHours(business.hours);
}

function normalizeGoogleTime(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return "";
  }

  return `${value.slice(0, 2)}:${value.slice(2)}`;
}

export function parseGooglePlacesPeriods(periods: unknown): BusinessHours | null {
  if (!Array.isArray(periods) || !periods.length) {
    return null;
  }

  const hours = createClosedBusinessHours();
  let foundAny = false;

  for (const period of periods) {
    if (!isRecord(period) || !isRecord(period.open)) {
      continue;
    }

    const openDay = numberValue(period.open.day, -1);
    const openTime = normalizeGoogleTime(stringValue(period.open.time));

    if (openDay < 0 || openDay > 6 || !openTime) {
      continue;
    }

    const dayKey = GOOGLE_DAY_TO_KEY[openDay];
    const closeRecord = isRecord(period.close) ? period.close : null;
    const closeTime = closeRecord
      ? normalizeGoogleTime(stringValue(closeRecord.time))
      : "23:59";

    hours[dayKey] = {
      open: openTime,
      close: closeTime || "23:59",
      closed: false
    };
    foundAny = true;
  }

  return foundAny ? hours : null;
}

export function formatReadableHours(hours: BusinessHours) {
  return DAY_KEYS.map((day) => {
    const label = day.slice(0, 3).replace(/^./, (char) => char.toUpperCase());
    const dailyHours = hours[day];

    if (dailyHours.closed) {
      return `${label} closed`;
    }

    return `${label} ${formatTime(dailyHours.open)}-${formatTime(dailyHours.close)}`;
  }).join(", ");
}

function normalizeResultStatus(value: unknown): AdminHoursSyncResultStatus {
  if (
    value === "found" ||
    value === "not_found" ||
    value === "approved" ||
    value === "skipped" ||
    value === "error"
  ) {
    return value;
  }

  return "not_found";
}

function normalizeSessionStatus(value: unknown): AdminSyncSessionStatus {
  if (value === "running" || value === "completed" || value === "failed") {
    return value;
  }

  return "running";
}

export function normalizeAdminHoursSyncResult(value: unknown): AdminHoursSyncResult {
  const record = isRecord(value) ? value : {};

  return {
    businessId: stringValue(record.businessId).trim(),
    businessName: stringValue(record.businessName).trim(),
    address: stringValue(record.address).trim(),
    placeId: stringValue(record.placeId).trim() || null,
    matchedName: stringValue(record.matchedName).trim(),
    proposedHours: record.proposedHours ? normalizeHours(record.proposedHours) : null,
    status: normalizeResultStatus(record.status),
    message: stringValue(record.message).trim(),
    reviewedAt: parseDateValue(record.reviewedAt)
  };
}

export function normalizeAdminSyncSessionRecord(
  value: unknown,
  id: string
): AdminSyncSession {
  const record = isRecord(value) ? value : {};

  return {
    id,
    status: normalizeSessionStatus(record.status),
    processed: numberValue(record.processed),
    total: numberValue(record.total),
    candidateBusinessIds: Array.isArray(record.candidateBusinessIds)
      ? record.candidateBusinessIds.filter(
          (candidateId): candidateId is string => typeof candidateId === "string"
        )
      : [],
    results: Array.isArray(record.results)
      ? record.results.map((result) => normalizeAdminHoursSyncResult(result))
      : [],
    startedAt: parseDateValue(record.startedAt),
    updatedAt: parseDateValue(record.updatedAt),
    lastBatchAt: parseDateValue(record.lastBatchAt)
  };
}
