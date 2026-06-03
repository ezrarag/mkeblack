export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export type DailyHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type BusinessHours = Record<DayKey, DailyHours>;

export type BusinessSource = "import" | "manual" | "self-submitted";
export type HoursSource = "manual" | "google_places" | "imported_text";

export type ClaimInviteStatus = "not_invited" | "pending" | "claimed";

export type BusinessTagCategory =
  | "Identity"
  | "Dietary"
  | "Accessibility"
  | "Vibe"
  | "Service";

export type BusinessTag = {
  id: string;
  label: string;
  slug: string;
  category: BusinessTagCategory;
  active: boolean;
  adminOnly: boolean;
  createdAt: Date | null;
  usageCount: number;
};

export type TeamMemberRoleType = "owner" | "co_owner" | "team";

export type BusinessTeamMember = {
  id: string;
  uid: string | null;
  name: string;
  /** Display role label, e.g. "Chef", "Operations Manager" */
  role: string;
  /** Structural role — drives sort order and public headings */
  roleType: TeamMemberRoleType;
  /** Optional honorific / title, e.g. "Dr.", "Rev." */
  title: string;
  pronouns: string;
  bio: string;
  photoUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  /** Optional contact email shown publicly when displayContact is true */
  email: string;
  /** Optional contact phone shown publicly when displayContact is true */
  phone: string;
  /** Optional personal/business website */
  website: string;
  /** Whether to show email/phone/website on the public profile */
  displayContact: boolean;
  order: number;
  /** Kept for backward compatibility; derived from roleType === "owner" */
  isOwner: boolean;
  visible: boolean;
  addedAt: Date | null;
};

export type BusinessTeamMemberFormValues = {
  uid: string;
  name: string;
  role: string;
  roleType: TeamMemberRoleType;
  title: string;
  pronouns: string;
  bio: string;
  photoUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  email: string;
  phone: string;
  website: string;
  displayContact: boolean;
  order: number;
  /** Derived from roleType === "owner"; kept for write-path backward compat */
  isOwner: boolean;
  visible: boolean;
};

export type HomepageLink = {
  label: string;
  href: string;
};

export type HomepageModuleType =
  | "hero"
  | "featured_articles"
  | "membership_cta"
  | "member_discounts"
  | "editorial"
  | "custom"
  | "marketplace";

// ── Marketplace ──────────────────────────────────────────────────────────────

export const MARKETPLACE_LISTING_CATEGORIES = [
  "Food & Drink",
  "Beauty & Grooming",
  "Apparel & Accessories",
  "Art & Creative",
  "Health & Wellness",
  "Home & Living",
  "Professional Services",
  "Events & Experiences",
  "Digital",
  "Other"
] as const;

export type MarketplaceListingCategory =
  (typeof MARKETPLACE_LISTING_CATEGORIES)[number];

export type MarketplaceListing = {
  id: string;
  businessId: string;
  businessName: string;
  /** Denormalized from the business; drives Solidarity badge on card */
  businessSolidarity: boolean;
  name: string;
  description: string;
  /** 0 = free / contact for pricing */
  priceCents: number;
  photoUrl: string;
  category: string;
  available: boolean;
  featured: boolean;
  /** External purchase/order URL; if empty falls back to business profile */
  orderUrl: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type SavedMarketplaceListing = {
  listingId: string;
  businessId: string;
  businessName: string;
  name: string;
  description: string;
  priceCents: number;
  photoUrl: string;
  category: string;
  orderUrl: string;
  savedAt: Date | null;
};

export type MarketplaceListingFormValues = {
  name: string;
  description: string;
  priceCents: number;
  photoUrl: string;
  category: string;
  available: boolean;
  orderUrl: string;
};

/** Phase 1 stub — no payments processed yet */
export type MarketplaceOrder = {
  id: string;
  listingId: string;
  businessId: string;
  customerUid: string | null;
  customerEmail: string;
  status: "pending";
  createdAt: Date | null;
};

// ─────────────────────────────────────────────────────────────────────────────

type HomepageModuleBase<T extends HomepageModuleType, C> = {
  id: string;
  type: T;
  title: string;
  visible: boolean;
  order: number;
  content: C;
};

export type HeroHomepageModule = HomepageModuleBase<
  "hero",
  {
    headline: string;
    subheadline: string;
    ctaPrimary: HomepageLink;
    ctaSecondary: HomepageLink;
  }
>;

export type FeaturedArticlesHomepageModule = HomepageModuleBase<
  "featured_articles",
  {
    description: string;
    ctaLabel: string;
    ctaHref: string;
  }
>;

export type MembershipCtaHomepageModule = HomepageModuleBase<
  "membership_cta",
  {
    description: string;
    benefits: string[];
    cta: HomepageLink;
  }
>;

export type MemberDiscountsHomepageModule = HomepageModuleBase<
  "member_discounts",
  {
    description: string;
    emptyState: string;
  }
>;

export type EditorialHomepageModule = HomepageModuleBase<
  "editorial",
  {
    body: string;
    imageUrl: string;
  }
>;

export type CustomHomepageModule = HomepageModuleBase<
  "custom",
  {
    html: string;
  }
>;

export type MarketplaceHomepageModule = HomepageModuleBase<
  "marketplace",
  {
    description: string;
    maxItems: number;
    ctaLabel: string;
    ctaHref: string;
  }
>;

export type HomepageModule =
  | HeroHomepageModule
  | FeaturedArticlesHomepageModule
  | MembershipCtaHomepageModule
  | MemberDiscountsHomepageModule
  | EditorialHomepageModule
  | CustomHomepageModule
  | MarketplaceHomepageModule;

export type MemberDiscount = {
  id: string;
  businessName: string;
  logoUrl: string;
  discountText: string;
  businessUrl: string;
  active: boolean;
  order: number;
};

export type ArticleSummary = {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  imageUrl: string;
  publishedAt: Date | null;
};

export type BusinessCategory =
  | "Food & Drink"
  | "Hair, Beauty & Grooming"
  | "Retail & Shopping"
  | "Music, Entertainment & Culture"
  | "Arts, Media & Creative Services"
  | "Professional & Business Services"
  | "Health & Wellness"
  | "Mental Health"
  | "Education, Youth & Family Services"
  | "Home, Cleaning & Maintenance"
  | "Work & Event Spaces"
  | "Legal & Consulting"
  | "Automotive"
  | "Sports & Entertainment"
  | "Catering, Snacks & Drinks"
  | "Online Goods & Products"
  | "Online Clothing & Accessories"
  | "Nonprofits"
  | "Resources"
  | "Other";

export type Business = {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  instagramReelUrl: string;
  email: string;
  hoursText: string;
  neighborhood: string;
  tags: string[];
  hours: BusinessHours;
  hoursSource: HoursSource | null;
  hoursSkipped: boolean;
  hoursLastSynced: Date | null;
  photos: string[];
  ownerUid: string | null;
  active: boolean;
  hasTeamProfiles: boolean;
  source: BusinessSource;
  importedAt: Date | null;
  claimInviteStatus: ClaimInviteStatus;
  claimInvitedAt: Date | null;
  location: {
    lat: number;
    lng: number;
  };
  solidarityMember: boolean;
  solidarityMemberSince: Date | null;
  solidarityMemberExpiry: Date | null;
};

export type SolidarityMemberStatus = "active" | "expired" | "comp" | "pending";

export type SolidarityMember = {
  id: string;
  email: string;
  name: string;
  uid: string | null;
  businessId: string | null;
  status: SolidarityMemberStatus;
  joinedAt: Date | null;
  expiresAt: Date | null;
  notes: string;
  benefitIds: string[];
  paymentSource: "stripe" | "comp" | "manual";
  paymentReference: string;
};

export type BenefitType = {
  id: string;
  label: string;
  description: string;
  active: boolean;
  order: number;
};

export type UserRole = "business" | "admin" | "visitor";

export type UserProfile = {
  uid: string;
  email: string;
  role: UserRole;
  businessId: string;
};

export type BusinessFormValues = {
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  instagramReelUrl: string;
  email: string;
  hoursText: string;
  neighborhood: string;
  tags: string[];
  hours: BusinessHours;
  photos: string[];
  ownerUid: string;
  active: boolean;
  source: BusinessSource;
  location: {
    lat: number;
    lng: number;
  };
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type NeighborhoodGeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
};

export type MilwaukeeNeighborhood = {
  id: string;
  name: string;
  geojson: NeighborhoodGeoJsonFeature;
};

export type BusinessClaimInvite = {
  id: string;
  businessId: string;
  businessName: string;
  email: string;
  status: "pending" | "claimed";
  createdAt: Date | null;
  claimedAt: Date | null;
  claimedByUid: string | null;
};

export type AdminHoursSyncResultStatus =
  | "found"
  | "not_found"
  | "approved"
  | "skipped"
  | "error";

export type AdminHoursSyncResult = {
  businessId: string;
  businessName: string;
  address: string;
  placeId: string | null;
  matchedName: string;
  proposedHours: BusinessHours | null;
  status: AdminHoursSyncResultStatus;
  message: string;
  reviewedAt: Date | null;
};

export type AdminSyncSessionStatus = "running" | "completed" | "failed";

export type AdminSyncSession = {
  id: string;
  status: AdminSyncSessionStatus;
  processed: number;
  total: number;
  candidateBusinessIds: string[];
  results: AdminHoursSyncResult[];
  startedAt: Date | null;
  updatedAt: Date | null;
  lastBatchAt: Date | null;
};
