import type { UserCapability, UserProfile } from "@/lib/types";

export function normalizeCapabilities(value: unknown): UserCapability[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is UserCapability => item === "admin" || item === "business"
  );
}

export function profileHasCapability(
  profile: Pick<UserProfile, "capabilities" | "role" | "businessId"> | null,
  capability: UserCapability
) {
  if (!profile) {
    return false;
  }

  const capabilities = normalizeCapabilities(profile.capabilities);

  if (capabilities.includes(capability)) {
    return true;
  }

  if (capability === "admin") {
    return profile.role === "admin";
  }

  return profile.role === "business" || Boolean(profile.businessId);
}

export function addCapability(
  value: unknown,
  capability: UserCapability
): UserCapability[] {
  return Array.from(new Set([...normalizeCapabilities(value), capability]));
}

export function removeCapability(
  value: unknown,
  capability: UserCapability
): UserCapability[] {
  return normalizeCapabilities(value).filter((item) => item !== capability);
}
