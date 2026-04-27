import { BusinessTag, BusinessTagCategory } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const BUSINESS_TAG_CATEGORIES: BusinessTagCategory[] = [
  "Identity",
  "Dietary",
  "Accessibility",
  "Vibe",
  "Service"
];

export const DEFAULT_BUSINESS_TAGS: Array<
  Pick<BusinessTag, "label" | "category" | "adminOnly">
> = [
  { label: "Black-owned", category: "Identity", adminOnly: true },
  { label: "LGBTQ+ Affirming", category: "Identity", adminOnly: false },
  { label: "Woman-owned", category: "Identity", adminOnly: false },
  { label: "Veteran-owned", category: "Identity", adminOnly: false },
  { label: "Minority-owned", category: "Identity", adminOnly: false },
  { label: "Vegan Options", category: "Dietary", adminOnly: false },
  { label: "Vegetarian", category: "Dietary", adminOnly: false },
  { label: "Gluten-Free", category: "Dietary", adminOnly: false },
  { label: "Halal", category: "Dietary", adminOnly: false },
  { label: "Soul Food", category: "Dietary", adminOnly: false },
  { label: "Caribbean", category: "Dietary", adminOnly: false },
  { label: "Family-Friendly", category: "Vibe", adminOnly: false },
  { label: "Date Night", category: "Vibe", adminOnly: false },
  { label: "Live Music", category: "Vibe", adminOnly: false },
  { label: "Outdoor Seating", category: "Vibe", adminOnly: false },
  { label: "Late Night", category: "Vibe", adminOnly: false },
  {
    label: "Wheelchair Accessible",
    category: "Accessibility",
    adminOnly: false
  },
  { label: "ASL Friendly", category: "Accessibility", adminOnly: false },
  { label: "Delivery", category: "Service", adminOnly: false },
  { label: "Takeout", category: "Service", adminOnly: false },
  { label: "Catering", category: "Service", adminOnly: false },
  { label: "Appointment Only", category: "Service", adminOnly: false },
  { label: "Walk-ins Welcome", category: "Service", adminOnly: false }
];

export function normalizeTagSlugs(value: unknown) {
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

export function createBusinessTagId(labelOrSlug: string) {
  return slugify(labelOrSlug);
}

export function isBusinessTagCategory(
  value: unknown
): value is BusinessTagCategory {
  return (
    typeof value === "string" &&
    BUSINESS_TAG_CATEGORIES.includes(value as BusinessTagCategory)
  );
}
