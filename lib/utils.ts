import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function titleCase(value: string) {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) =>
      /^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part
    )
    .join("");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizeUrl(value: string) {
  if (!value.trim()) {
    return "";
  }

  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

export function normalizeHref(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (
    trimmedValue.startsWith("/") ||
    trimmedValue.startsWith("#") ||
    trimmedValue.startsWith("?") ||
    trimmedValue.startsWith("mailto:") ||
    trimmedValue.startsWith("tel:")
  ) {
    return trimmedValue;
  }

  if (/^(https?:)?\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  if (/^[a-z0-9/_-]+$/i.test(trimmedValue)) {
    return `/${trimmedValue.replace(/^\/+/, "")}`;
  }

  return normalizeUrl(trimmedValue);
}

export function isExternalHref(value: string) {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("mailto:") || value.startsWith("tel:");
}
