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

export type ClaimInviteStatus = "not_invited" | "pending" | "claimed";

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
  | "custom";

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

export type HomepageModule =
  | HeroHomepageModule
  | FeaturedArticlesHomepageModule
  | MembershipCtaHomepageModule
  | MemberDiscountsHomepageModule
  | EditorialHomepageModule
  | CustomHomepageModule;

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
  | "Retail"
  | "Services"
  | "Health & Wellness"
  | "Arts & Culture"
  | "Beauty"
  | "Professional"
  | "Community"
  | "Other";

export type Business = {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  hoursText: string;
  hours: BusinessHours;
  photos: string[];
  ownerUid: string | null;
  active: boolean;
  source: BusinessSource;
  importedAt: Date | null;
  claimInviteStatus: ClaimInviteStatus;
  claimInvitedAt: Date | null;
  location: {
    lat: number;
    lng: number;
  };
};

export type UserRole = "business" | "admin";

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
  email: string;
  hoursText: string;
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
