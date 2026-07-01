import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import {
  BusinessAnalyticsDimension,
  BusinessAnalyticsEventType
} from "@/lib/types";

export type TrackBusinessAnalyticsInput = {
  businessId: string;
  eventType: BusinessAnalyticsEventType;
  regionBucket?: string | null;
  referralSource?: string | null;
  ageBucket?: string | null;
  interestBuckets?: string[];
  linkTarget?: string | null;
  periodKey?: string | null;
};

type BucketDescriptor = {
  dimension: BusinessAnalyticsDimension;
  bucket: string;
};

const MAX_BUCKET_LENGTH = 64;

function normalizeBucket(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_BUCKET_LENGTH);

  return normalized || null;
}

function defaultPeriodKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function bucketDescriptors(
  input: TrackBusinessAnalyticsInput
): BucketDescriptor[] {
  const descriptors: BucketDescriptor[] = [];
  const regionBucket = normalizeBucket(input.regionBucket);
  const referralSource = normalizeBucket(input.referralSource);
  const ageBucket = normalizeBucket(input.ageBucket);
  const linkTarget = normalizeBucket(input.linkTarget);

  if (regionBucket) {
    descriptors.push({ dimension: "region", bucket: regionBucket });
  }

  if (referralSource) {
    descriptors.push({
      dimension: "referral_source",
      bucket: referralSource
    });
  }

  if (ageBucket) {
    descriptors.push({ dimension: "audience_age", bucket: ageBucket });
  }

  if (input.eventType === "link_click" && linkTarget) {
    descriptors.push({ dimension: "link_target", bucket: linkTarget });
  }

  const interestBuckets = Array.from(
    new Set(
      (input.interestBuckets ?? [])
        .map((interest) => normalizeBucket(interest))
        .filter((interest): interest is string => Boolean(interest))
    )
  );

  for (const interestBucket of interestBuckets) {
    descriptors.push({
      dimension: "audience_interest",
      bucket: interestBucket
    });
  }

  return descriptors;
}

export async function trackBusinessAnalytics(
  input: TrackBusinessAnalyticsInput
) {
  const businessId = input.businessId.trim();

  if (!businessId) {
    throw new Error("businessId is required.");
  }

  const periodKey = normalizeBucket(input.periodKey) ?? defaultPeriodKey();
  const db = getFirebaseAdminDb();
  const businessReference = db.collection("businesses").doc(businessId);
  const batch = db.batch();
  const summaryField =
    input.eventType === "profile_view"
      ? "analyticsSummary.totalProfileViews"
      : "analyticsSummary.totalLinkClicks";

  batch.set(
    businessReference,
    {
      [summaryField]: FieldValue.increment(1),
      "analyticsSummary.lastActivityAt": FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  for (const descriptor of bucketDescriptors(input)) {
    const docId = [
      periodKey,
      input.eventType,
      descriptor.dimension,
      descriptor.bucket
    ].join("__");

    batch.set(
      businessReference.collection("analyticsBuckets").doc(docId),
      {
        periodKey,
        eventType: input.eventType,
        dimension: descriptor.dimension,
        bucket: descriptor.bucket,
        totalCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();
}
