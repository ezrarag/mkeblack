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

function articleIsPublished(data: Record<string, unknown>) {
  if (typeof data.published === "boolean") return data.published;
  if (typeof data.status === "string") return data.status === "published";
  return true;
}

function slugCandidates(value: string) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Next normally decodes route params, but a malformed legacy URL should
    // still get an exact-match lookup instead of crashing the page.
  }

  const cleaned = decoded.trim().replace(/^\/+|\/+$/g, "");
  return Array.from(new Set([cleaned, cleaned.toLowerCase()].filter(Boolean)));
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
  const candidates = slugCandidates(slug);
  if (!candidates.length) {
    return null;
  }

  const db = getFirebaseAdminDb();

  for (const candidate of candidates) {
    const snapshot = await db
      .collection("articles")
      .where("slug", "==", candidate)
      .limit(1)
      .get();

    const articleDoc = snapshot.docs[0];
    const articleData = articleDoc?.data();
    if (articleDoc && articleData && articleIsPublished(articleData)) {
      return publicArticleFromDoc(articleDoc);
    }
  }

  // Some migrated Wix records used a stable document id before a slug field
  // was backfilled. Supporting that id keeps old inbound links working.
  for (const candidate of candidates) {
    const articleDoc = await db.collection("articles").doc(candidate).get();
    const articleData = articleDoc.data();
    if (articleDoc.exists && articleData && articleIsPublished(articleData)) {
      return publicArticleFromDoc(articleDoc);
    }
  }

  return null;
}
