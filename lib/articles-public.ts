import { getFirebaseAdminDb } from "@/lib/firebase/admin";
import { PublicArticle } from "@/lib/types";

type FirestoreDoc = {
  id: string;
  data(): Record<string, unknown> | undefined;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSourceHref(value: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("/articles/")) {
    return "";
  }

  return value;
}

function publicArticleFromDoc(doc: FirestoreDoc): PublicArticle {
  const data = doc.data() ?? {};
  const slug = text(data.slug);
  const body = text(data.body || data.content);
  const rawHref = text(data.href || data.url || data.externalUrl);
  const href = slug ? `/articles/${slug}` : rawHref;

  return {
    id: doc.id,
    title: text(data.title || data.headline) || "Untitled article",
    slug,
    excerpt:
      text(data.excerpt || data.summary || data.description || data.deck),
    body,
    href,
    sourceHref: normalizeSourceHref(rawHref),
    imageUrl: text(
      data.imageUrl ||
        data.coverImageUrl ||
        data.thumbnailUrl ||
        data.heroImageUrl
    ),
    publishedAt: toDate(data.publishedAt || data.createdAt || data.updatedAt),
    author: text(data.author) || "MKE Black",
    readTime: text(data.readTime),
    source: text(data.source) || "manual",
    hasContent: Boolean(body)
  };
}

export async function getPublicArticleBySlug(slug: string) {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    return null;
  }

  const snapshot = await getFirebaseAdminDb()
    .collection("articles")
    .where("slug", "==", normalizedSlug)
    .where("published", "==", true)
    .limit(1)
    .get();

  const articleDoc = snapshot.docs[0];
  return articleDoc ? publicArticleFromDoc(articleDoc) : null;
}
