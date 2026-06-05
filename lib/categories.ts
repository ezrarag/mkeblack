import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { BusinessCategoryOption } from "@/lib/types";

export function createBusinessCategoryId(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createFallbackBusinessCategories(): BusinessCategoryOption[] {
  return BUSINESS_CATEGORIES.map((label) => ({
    id: createBusinessCategoryId(label),
    label,
    slug: createBusinessCategoryId(label),
    active: true,
    createdAt: null,
    usageCount: 0
  }));
}

export function getBusinessCategoryLabels(
  categories: BusinessCategoryOption[],
  currentCategory?: string
) {
  const activeLabels = categories
    .filter((category) => category.active)
    .map((category) => category.label);

  return Array.from(
    new Set([...activeLabels, currentCategory ?? ""].filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));
}
