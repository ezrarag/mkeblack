import { DirectoryHeroConfig } from "@/lib/types";

export const DIRECTORY_HERO_CONFIG_ID = "directory_page";

export const DEFAULT_DIRECTORY_HERO_IMAGES = [
  "https://firebasestorage.googleapis.com/v0/b/mkeblack-c6dfe.firebasestorage.app/o/assets%2Fmkeairport.jpeg?alt=media&token=fe445b9c-0ac5-4255-b1f3-6db4496787b0",
  "https://firebasestorage.googleapis.com/v0/b/mkeblack-c6dfe.firebasestorage.app/o/assets%2Fmkeartmuseum.jpeg?alt=media&token=0221aa00-2f8f-4aea-a371-3c00e4371209",
  "https://firebasestorage.googleapis.com/v0/b/mkeblack-c6dfe.firebasestorage.app/o/assets%2Fhoanbridgemke.jpeg?alt=media&token=28832675-12dd-4db0-9f06-5319cbfa6dcd",
  "https://firebasestorage.googleapis.com/v0/b/mkeblack-c6dfe.firebasestorage.app/o/assets%2Ffiservstadiummke.jpeg?alt=media&token=c2c60bfe-1e93-4cfd-af42-f350979cdf0e",
  "https://firebasestorage.googleapis.com/v0/b/mkeblack-c6dfe.firebasestorage.app/o/assets%2Fbrewersstadiummke.jpeg?alt=media&token=40dfc41a-aa26-4be2-9981-7d20517c4b0a"
];

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringListValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
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

export function normalizeDirectoryHeroConfig(
  value: unknown,
  id = DIRECTORY_HERO_CONFIG_ID
): DirectoryHeroConfig {
  const record = isRecord(value) ? value : {};
  const hasHeroImages = "heroImages" in record;
  const heroImages = hasHeroImages
    ? stringListValue(record.heroImages)
    : DEFAULT_DIRECTORY_HERO_IMAGES;

  return {
    id,
    heroImages,
    updatedAt: parseDateValue(record.updatedAt)
  };
}
