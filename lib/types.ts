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
export type BusinessModerationStatus = "approved" | "pending";
export type BusinessAnalyticsEventType = "profile_view" | "link_click";
export type BusinessAnalyticsDimension =
  | "region"
  | "referral_source"
  | "audience_age"
  | "audience_interest"
  | "link_target";

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

export type MarketplaceCheckoutMode = "external" | "native";

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
  checkoutMode: MarketplaceCheckoutMode;
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

// ── Visitor ↔ Business messaging ──────────────────────────────────────────
// One thread per (visitor, business) pair. Only Solidarity Circle member
// businesses can receive messages — gated both in the UI and in
// firestore.rules (isSolidarityBusiness).
export type MessageSenderRole = "visitor" | "business" | "admin";

export type MessageThread = {
  id: string;
  businessId: string;
  businessName: string;
  businessPhotoUrl: string;
  visitorUid: string;
  visitorName: string;
  lastMessage: string;
  lastMessageAt: Date | null;
  lastSenderRole: MessageSenderRole | null;
  visitorUnread: number;
  businessUnread: number;
  createdAt: Date | null;
};

export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: MessageSenderRole;
  senderName: string;
  text: string;
  createdAt: Date | null;
};

// ── Business reviews ───────────────────────────────────────────────────────
// One review per (visitor, business) pair, id = `${businessId}_${authorUid}`
// — an upsert pattern so a visitor edits their existing review instead of
// stacking duplicates. `status` is admin-controlled for moderation; authors
// can only edit their own content fields.
export type ReviewStatus = "published" | "flagged" | "removed";

export type BusinessReview = {
  id: string;
  businessId: string;
  businessName: string;
  authorUid: string;
  authorName: string;
  rating: number;
  text: string;
  photos: string[];
  relatedListingId: string | null;
  relatedListingName: string | null;
  relatedEventId: string | null;
  relatedEventName: string | null;
  status: ReviewStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type GroupStatus = "active" | "archived" | "flagged";

export type Group = {
  id: string;
  name: string;
  description: string;
  businessId: string | null;
  businessName: string | null;
  coverPhotoUrl: string;
  creatorUid: string;
  creatorName: string;
  status: GroupStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type GroupMemberRole = "owner" | "member";

export type GroupMember = {
  uid: string;
  groupId: string;
  displayName: string;
  role: GroupMemberRole;
  joinedAt: Date | null;
};

export type GroupPostStatus = "published" | "flagged" | "removed";

export type GroupPost = {
  id: string;
  groupId: string;
  authorUid: string;
  authorName: string;
  text: string;
  photos: string[];
  likeUids: string[];
  status: GroupPostStatus;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type NotificationType =
  | "group_post"
  | "group_mention"
  | "group_event"
  | "group_member_joined";

export type NotificationPrefs = Record<NotificationType, boolean>;

export type UserNotification = {
  id: string;
  type: NotificationType;
  groupId: string;
  groupName: string;
  actorUid: string;
  actorName: string;
  targetId: string;
  text: string;
  href: string;
  read: boolean;
  createdAt: Date | null;
};

export type MarketplaceListingFormValues = {
  name: string;
  description: string;
  priceCents: number;
  photoUrl: string;
  category: string;
  available: boolean;
  checkoutMode: MarketplaceCheckoutMode;
  orderUrl: string;
};

export type MarketplaceOrderStatus = "pending" | "paid" | "cancelled";

export type MarketplaceOrder = {
  id: string;
  listingId: string;
  listingName: string;
  businessId: string;
  businessName: string;
  customerUid: string | null;
  customerEmail: string;
  amountCents: number;
  platformFeeCents: number;
  netToBusinessCents: number;
  stripeCheckoutSessionId: string;
  stripeCustomerId: string;
  stripePaymentStatus: string;
  status: MarketplaceOrderStatus;
  createdAt: Date | null;
  paidAt: Date | null;
};

export type RevenueShareLedgerStatus = "pending_payout" | "paid_out";

export type RevenueShareLedgerEntry = {
  id: string;
  orderId: string;
  businessId: string;
  businessName: string;
  saleAmountCents: number;
  platformFeeCents: number;
  netToBusinessCents: number;
  status: RevenueShareLedgerStatus;
  createdAt: Date | null;
  paidOutAt: Date | null;
};

// ── Events ───────────────────────────────────────────────────────────────────

export type BusinessEventStatus = "draft" | "published" | "cancelled";

export type EventTicketType = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  quantityTotal: number;
  quantitySold: number;
  active: boolean;
};

export type BusinessEvent = {
  id: string;
  businessId: string;
  businessName: string;
  businessSolidarity: boolean;
  title: string;
  description: string;
  imageUrl: string;
  venueName: string;
  address: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: BusinessEventStatus;
  ticketTypes: EventTicketType[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type BusinessEventFormValues = {
  title: string;
  description: string;
  imageUrl: string;
  venueName: string;
  address: string;
  startsAt: string;
  endsAt: string;
  status: BusinessEventStatus;
  ticketTypes: EventTicketType[];
};

export type EventTicketOrderStatus = "pending" | "paid" | "free" | "cancelled";

export type EventTicketOrder = {
  id: string;
  eventId: string;
  businessId: string;
  ticketTypeId: string;
  ticketName: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  status: EventTicketOrderStatus;
  stripeCheckoutSessionId: string;
  createdAt: Date | null;
  paidAt: Date | null;
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
    heroImages: string[];
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
  slug: string;
  excerpt: string;
  href: string;
  sourceHref: string;
  imageUrl: string;
  publishedAt: Date | null;
  author: string;
  readTime: string;
  source: string;
  hasContent: boolean;
};

export type PublicArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  href: string;
  sourceHref: string;
  imageUrl: string;
  publishedAt: Date | null;
  author: string;
  readTime: string;
  source: string;
  hasContent: boolean;
};

export type DirectoryHeroConfig = {
  id: string;
  heroImages: string[];
  updatedAt: Date | null;
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

export type BusinessCategoryOption = {
  id: string;
  label: string;
  slug: string;
  active: boolean;
  createdAt: Date | null;
  usageCount: number;
};

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
  analyticsSummary: {
    totalProfileViews: number;
    totalLinkClicks: number;
    lastActivityAt: Date | null;
  };
  moderationStatus: BusinessModerationStatus;
  hasTeamProfiles: boolean;
  source: BusinessSource;
  importedAt: Date | null;
  claimInviteStatus: ClaimInviteStatus;
  claimInvitedAt: Date | null;
  googlePlaceId: string;
  googleMatchedName: string;
  googleMapsUrl: string;
  googleProfileLastSynced: Date | null;
  yelpBusinessId: string;
  yelpAlias: string;
  yelpUrl: string;
  yelpRating: number | null;
  yelpReviewCount: number | null;
  yelpPhotos: string[];
  yelpReviews: YelpReviewExcerpt[];
  yelpHours: YelpHoursPeriod[];
  yelpLastSyncedAt: Date | null;
  yelpLastSyncError: string;
  location: {
    lat: number;
    lng: number;
  };
  locationVerified: boolean;
  geocodingStatus: "verified" | "manual" | "failed" | "needs_geocode";
  onlineBased: boolean;
  solidarityMember: boolean;
  solidarityMemberSince: Date | null;
  solidarityMemberExpiry: Date | null;
  solidarityMembershipSource: "stripe" | "manual" | "comp";
  solidarityMembershipNotes: string;
};

export type BusinessAnalyticsBucket = {
  id: string;
  periodKey: string;
  eventType: BusinessAnalyticsEventType;
  dimension: BusinessAnalyticsDimension;
  bucket: string;
  totalCount: number;
  updatedAt: Date | null;
};

export type YelpReviewExcerpt = {
  id: string;
  rating: number | null;
  text: string;
  url: string;
  timeCreated: string;
  userName: string;
  userImageUrl: string;
};

export type YelpHoursPeriod = {
  day: number;
  start: string;
  end: string;
  isOvernight: boolean;
};

export type SolidarityMemberStatus =
  | "active"
  | "expired"
  | "comp"
  | "pending"
  | "rejected"
  | "trash";

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
export type UserCapability = "admin" | "business";

export type UserProfile = {
  uid: string;
  email: string;
  role: UserRole;
  capabilities?: UserCapability[];
  businessId: string | null;
  // ── Optional / opt-in account details ──────────────────────────────────
  // None of these are collected silently — visitors choose to fill them in
  // from their dashboard ("About you"). Used for aggregate admin insight
  // only; individual values stay private to the user + admins.
  displayName?: string | null;
  createdAt?: Date | null;
  neighborhood?: string | null;
  interests?: string[];
  referralSource?: string | null;
  notificationPrefs?: Partial<NotificationPrefs>;
  authProviderIds?: string[];
  lastAuthProviderId?: string | null;
  lastLoginMethod?: string | null;
  lastLoginIntent?: string | null;
  lastLoginAt?: Date | null;
  lastRequestedLoginMethod?: string | null;
  passwordResetRequestedAt?: Date | null;
};

// "How did you hear about us" — kept short and easy to pick from a select.
export const REFERRAL_SOURCES = [
  "Friend or family",
  "Social media",
  "A business in the directory",
  "Search engine",
  "Community event",
  "News or article",
  "Other"
] as const;

export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

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
  onlineBased: boolean;
  source: BusinessSource;
  yelpBusinessId: string;
  yelpAlias: string;
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
  proposedProfile: {
    address: string;
    phone: string;
    website: string;
    googleMapsUrl: string;
    location: {
      lat: number;
      lng: number;
    } | null;
  } | null;
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
