import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function titleCase(value: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
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
