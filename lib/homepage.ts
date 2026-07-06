import {
  ArticleSummary,
  CustomHomepageModule,
  EditorialHomepageModule,
  FeaturedArticlesHomepageModule,
  HeroHomepageModule,
  HomepageLink,
  HomepageModule,
  HomepageModuleType,
  MarketplaceHomepageModule,
  MemberDiscount,
  MemberDiscountsHomepageModule,
  MembershipCtaHomepageModule
} from "@/lib/types";
import { normalizeHref, normalizeUrl } from "@/lib/utils";

const DEFAULT_MEMBERSHIP_BENEFITS = [
  "Members get first access to curated community perks.",
  "Support Milwaukee's Black-owned businesses year-round.",
  "Stay close to campaigns, events, and partner offers."
];

export const DEFAULT_HOMEPAGE_HERO_IMAGE_URL =
  "https://firebasestorage.googleapis.com/v0/b/mkeblack-c6dfe.firebasestorage.app/o/assets%2FScreenshot%202026-06-04%20at%2010.59.48%E2%80%AFAM.png?alt=media&token=ce47f8a7-439a-4fb9-8fa8-5f837f410337";

type FirestoreRecord = Record<string, unknown>;

export const HOMEPAGE_MODULE_TYPES: HomepageModuleType[] = [
  "hero",
  "featured_articles",
  "membership_cta",
  "member_discounts",
  "editorial",
  "custom",
  "marketplace"
];

export const HOMEPAGE_MODULE_LABELS: Record<HomepageModuleType, string> = {
  hero: "Hero",
  featured_articles: "Featured articles",
  membership_cta: "Membership CTA",
  member_discounts: "Member discounts",
  editorial: "Editorial",
  custom: "Custom HTML",
  marketplace: "Marketplace"
};

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function normalizeLink(value: unknown): HomepageLink {
  const record = isRecord(value) ? value : {};

  return {
    label: stringValue(record.label).trim(),
    href: normalizeHref(stringValue(record.href))
  };
}

function normalizeHeroContent(value: unknown): HeroHomepageModule["content"] {
  const record = isRecord(value) ? value : {};
  const heroImages =
    "heroImages" in record
      ? stringListValue(record.heroImages)
      : stringListValue([record.heroImageUrl, record.imageUrl]).length
        ? stringListValue([record.heroImageUrl, record.imageUrl])
        : [DEFAULT_HOMEPAGE_HERO_IMAGE_URL];

  return {
    headline: stringValue(record.headline).trim(),
    subheadline: stringValue(record.subheadline).trim(),
    heroImages,
    ctaPrimary: normalizeLink(record.ctaPrimary),
    ctaSecondary: normalizeLink(record.ctaSecondary)
  };
}

function normalizeFeaturedArticlesContent(
  value: unknown
): FeaturedArticlesHomepageModule["content"] {
  const record = isRecord(value) ? value : {};

  return {
    description: stringValue(record.description).trim(),
    ctaLabel: stringValue(record.ctaLabel).trim(),
    ctaHref: normalizeHref(stringValue(record.ctaHref))
  };
}

function normalizeMembershipContent(
  value: unknown
): MembershipCtaHomepageModule["content"] {
  const record = isRecord(value) ? value : {};

  return {
    description: stringValue(record.description).trim(),
    benefits: stringListValue(record.benefits),
    cta: normalizeLink(record.cta)
  };
}

function normalizeMemberDiscountsContent(
  value: unknown
): MemberDiscountsHomepageModule["content"] {
  const record = isRecord(value) ? value : {};

  return {
    description: stringValue(record.description).trim(),
    emptyState: stringValue(record.emptyState).trim()
  };
}

function normalizeEditorialContent(
  value: unknown
): EditorialHomepageModule["content"] {
  const record = isRecord(value) ? value : {};

  return {
    body: stringValue(record.body),
    imageUrl: stringValue(record.imageUrl).trim()
  };
}

function normalizeCustomContent(value: unknown): CustomHomepageModule["content"] {
  const record = isRecord(value) ? value : {};

  return {
    html: stringValue(record.html)
  };
}

function normalizeMarketplaceContent(
  value: unknown
): MarketplaceHomepageModule["content"] {
  const record = isRecord(value) ? value : {};

  return {
    description: stringValue(record.description).trim(),
    maxItems: numberValue(record.maxItems, 6),
    ctaLabel: stringValue(record.ctaLabel).trim(),
    ctaHref: normalizeHref(stringValue(record.ctaHref))
  };
}

function parseDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
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

export function isHomepageModuleType(value: unknown): value is HomepageModuleType {
  return HOMEPAGE_MODULE_TYPES.includes(value as HomepageModuleType);
}

export function createHomepageModuleDraft(type: HomepageModuleType): HomepageModule {
  switch (type) {
    case "hero":
      return {
        id: "",
        type,
        title: "Homepage hero",
        visible: true,
        order: 0,
        content: {
          headline: "Celebrate Milwaukee's Black business community.",
          subheadline:
            "Publish a flexible homepage that highlights stories, perks, and the people building the city forward.",
          heroImages: [DEFAULT_HOMEPAGE_HERO_IMAGE_URL],
          ctaPrimary: {
            label: "Browse the directory",
            href: "/directory"
          },
          ctaSecondary: {
            label: "",
            href: ""
          }
        }
      };
    case "featured_articles":
      return {
        id: "",
        type,
        title: "Latest stories",
        visible: true,
        order: 0,
        content: {
          description:
            "Pull the latest stories from Firestore and keep fresh reporting near the top of the homepage.",
          ctaLabel: "",
          ctaHref: ""
        }
      };
    case "membership_cta":
      return {
        id: "",
        type,
        title: "Become a member",
        visible: true,
        order: 0,
        content: {
          description:
            "Give supporters a direct path into membership with clear reasons to join now.",
          benefits: DEFAULT_MEMBERSHIP_BENEFITS,
          cta: {
            label: "Join membership",
            href: "/membership"
          }
        }
      };
    case "member_discounts":
      return {
        id: "",
        type,
        title: "Member discounts",
        visible: true,
        order: 0,
        content: {
          description:
            "Feature active member offers from Black-owned businesses and partner organizations.",
          emptyState: "Fresh member offers are on the way."
        }
      };
    case "editorial":
      return {
        id: "",
        type,
        title: "Editorial spotlight",
        visible: true,
        order: 0,
        content: {
          body: "## Add a story\n\nUse markdown to publish a mission update, campaign note, or community feature.",
          imageUrl: ""
        }
      };
    case "custom":
      return {
        id: "",
        type,
        title: "Custom embed",
        visible: true,
        order: 0,
        content: {
          html: "<div><p>Add custom homepage HTML here.</p></div>"
        }
      };
    case "marketplace":
      return {
        id: "",
        type,
        title: "Marketplace",
        visible: true,
        order: 0,
        content: {
          description: "Browse products and services from Milwaukee's Black-owned businesses.",
          maxItems: 6,
          ctaLabel: "Browse marketplace",
          ctaHref: "/marketplace"
        }
      };
  }
}

export function cloneHomepageModule(module: HomepageModule): HomepageModule {
  switch (module.type) {
    case "hero":
      return {
        ...module,
        content: {
          ...module.content,
          heroImages: [...module.content.heroImages],
          ctaPrimary: { ...module.content.ctaPrimary },
          ctaSecondary: { ...module.content.ctaSecondary }
        }
      };
    case "featured_articles":
      return {
        ...module,
        content: { ...module.content }
      };
    case "member_discounts":
      return {
        ...module,
        content: { ...module.content }
      };
    case "editorial":
      return {
        ...module,
        content: { ...module.content }
      };
    case "custom":
      return {
        ...module,
        content: { ...module.content }
      };
    case "membership_cta":
      return {
        ...module,
        content: {
          ...module.content,
          benefits: [...module.content.benefits],
          cta: { ...module.content.cta }
        }
      };
    case "marketplace":
      return {
        ...module,
        content: { ...module.content }
      };
  }
}

export function normalizeHomepageModule(
  value: unknown,
  id: string
): HomepageModule {
  const record = isRecord(value) ? value : {};
  const type = isHomepageModuleType(record.type) ? record.type : "custom";
  const title = stringValue(record.title).trim();
  const visible = booleanValue(record.visible, true);
  const order = numberValue(record.order, 0);

  switch (type) {
    case "hero":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeHeroContent(record.content)
      };
    case "featured_articles":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeFeaturedArticlesContent(record.content)
      };
    case "membership_cta":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeMembershipContent(record.content)
      };
    case "member_discounts":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeMemberDiscountsContent(record.content)
      };
    case "editorial":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeEditorialContent(record.content)
      };
    case "custom":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeCustomContent(record.content)
      };
    case "marketplace":
      return {
        id,
        type,
        title,
        visible,
        order,
        content: normalizeMarketplaceContent(record.content)
      };
  }
}

export function serializeHomepageModule(module: HomepageModule) {
  const baseValues = {
    id: module.id,
    type: module.type,
    title: module.title.trim(),
    visible: Boolean(module.visible),
    order: Number.isFinite(module.order) ? module.order : 0
  };

  switch (module.type) {
    case "hero":
      return {
        ...baseValues,
        content: {
          headline: module.content.headline.trim(),
          subheadline: module.content.subheadline.trim(),
          heroImages: module.content.heroImages
            .map((imageUrl) => imageUrl.trim())
            .filter(Boolean),
          ctaPrimary: normalizeLink(module.content.ctaPrimary),
          ctaSecondary: normalizeLink(module.content.ctaSecondary)
        }
      };
    case "featured_articles":
      return {
        ...baseValues,
        content: {
          description: module.content.description.trim(),
          ctaLabel: module.content.ctaLabel.trim(),
          ctaHref: normalizeHref(module.content.ctaHref)
        }
      };
    case "membership_cta":
      return {
        ...baseValues,
        content: {
          description: module.content.description.trim(),
          benefits: module.content.benefits
            .map((benefit) => benefit.trim())
            .filter(Boolean),
          cta: normalizeLink(module.content.cta)
        }
      };
    case "member_discounts":
      return {
        ...baseValues,
        content: {
          description: module.content.description.trim(),
          emptyState: module.content.emptyState.trim()
        }
      };
    case "editorial":
      return {
        ...baseValues,
        content: {
          body: module.content.body,
          imageUrl: module.content.imageUrl.trim()
        }
      };
    case "custom":
      return {
        ...baseValues,
        content: {
          html: module.content.html
        }
      };
    case "marketplace":
      return {
        ...baseValues,
        content: {
          description: module.content.description.trim(),
          maxItems: Number.isFinite(module.content.maxItems)
            ? module.content.maxItems
            : 6,
          ctaLabel: module.content.ctaLabel.trim(),
          ctaHref: normalizeHref(module.content.ctaHref)
        }
      };
  }
}

export function sortHomepageModules(modules: HomepageModule[]) {
  return [...modules].sort(
    (left, right) => left.order - right.order || left.title.localeCompare(right.title)
  );
}

export function syncHomepageModuleOrder(modules: HomepageModule[]) {
  return modules.map((module, index) => ({
    ...module,
    order: index
  }));
}

export function createMemberDiscountDraft(): MemberDiscount {
  return {
    id: "",
    businessName: "",
    logoUrl: "",
    discountText: "",
    businessUrl: "",
    active: true,
    order: 0
  };
}

export function cloneMemberDiscount(discount: MemberDiscount): MemberDiscount {
  return { ...discount };
}

export function normalizeMemberDiscount(
  value: unknown,
  id: string
): MemberDiscount {
  const record = isRecord(value) ? value : {};

  return {
    id,
    businessName: stringValue(record.businessName).trim(),
    logoUrl: stringValue(record.logoUrl).trim(),
    discountText: stringValue(record.discountText).trim(),
    businessUrl: normalizeUrl(stringValue(record.businessUrl).trim()),
    active: booleanValue(record.active, true),
    order: numberValue(record.order, 0)
  };
}

export function serializeMemberDiscount(discount: MemberDiscount) {
  return {
    id: discount.id,
    businessName: discount.businessName.trim(),
    logoUrl: discount.logoUrl.trim(),
    discountText: discount.discountText.trim(),
    businessUrl: normalizeUrl(discount.businessUrl.trim()),
    active: Boolean(discount.active),
    order: Number.isFinite(discount.order) ? discount.order : 0
  };
}

export function sortMemberDiscounts(discounts: MemberDiscount[]) {
  return [...discounts].sort(
    (left, right) =>
      left.order - right.order || left.businessName.localeCompare(right.businessName)
  );
}

export function syncMemberDiscountOrder(discounts: MemberDiscount[]) {
  return discounts.map((discount, index) => ({
    ...discount,
    order: index
  }));
}

export function isPublishedArticle(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.published === "boolean") {
    return value.published;
  }

  if (typeof value.status === "string") {
    return value.status === "published";
  }

  return true;
}

export function normalizeArticleSummary(
  value: unknown,
  id: string
): ArticleSummary {
  const record = isRecord(value) ? value : {};
  const slug = stringValue(record.slug).trim();
  const explicitHref = stringValue(record.href || record.url || record.externalUrl).trim();
  const source = stringValue(record.source).trim();
  const fallbackExternalHref =
    source === "migrated_wix" && slug
      ? `https://www.mkeblack.org/post/${slug}`
      : "";
  const normalizedExplicitHref =
    explicitHref && !explicitHref.includes("/") && !explicitHref.includes(".")
      ? source === "migrated_wix"
        ? `https://www.mkeblack.org/post/${explicitHref}`
        : normalizeHref(explicitHref)
      : explicitHref
        ? normalizeHref(explicitHref)
        : "";

  return {
    id,
    title:
      stringValue(record.title || record.headline).trim() || "Untitled article",
    excerpt:
      stringValue(
        record.excerpt ||
          record.summary ||
          record.description ||
          record.deck
      ).trim(),
    href: normalizedExplicitHref || fallbackExternalHref,
    imageUrl: stringValue(
      record.imageUrl ||
        record.coverImageUrl ||
        record.thumbnailUrl ||
        record.heroImageUrl
    ).trim(),
    publishedAt: parseDateValue(
      record.publishedAt || record.createdAt || record.updatedAt
    )
  };
}

export function sortArticleSummaries(articles: ArticleSummary[]) {
  return [...articles].sort(
    (left, right) =>
      (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0)
  );
}
