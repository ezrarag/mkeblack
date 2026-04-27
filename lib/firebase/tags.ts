import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { BusinessTag, BusinessTagCategory } from "@/lib/types";
import {
  createBusinessTagId,
  isBusinessTagCategory,
  normalizeTagSlugs
} from "@/lib/tags";

const COLLECTION_NAME = "business_tags";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  return {
    db,
    firestoreModule
  };
}

export function normalizeBusinessTagRecord(value: unknown, id: string): BusinessTag {
  const record = isRecord(value) ? value : {};
  const label = typeof record.label === "string" ? record.label.trim() : id;
  const slug =
    typeof record.slug === "string" && record.slug.trim()
      ? record.slug.trim()
      : createBusinessTagId(label);
  const category = isBusinessTagCategory(record.category)
    ? record.category
    : "Service";

  return {
    id,
    label,
    slug,
    category,
    active: typeof record.active === "boolean" ? record.active : true,
    adminOnly: typeof record.adminOnly === "boolean" ? record.adminOnly : false,
    createdAt: parseDateValue(record.createdAt),
    usageCount:
      typeof record.usageCount === "number" && Number.isFinite(record.usageCount)
        ? record.usageCount
        : 0
  };
}

export function sortBusinessTags(tags: BusinessTag[]) {
  return [...tags].sort((left, right) => {
    const categoryCompare = left.category.localeCompare(right.category);
    return categoryCompare || left.label.localeCompare(right.label);
  });
}

export async function addBusinessTag(values: {
  label: string;
  slug?: string;
  category: BusinessTagCategory;
  adminOnly: boolean;
}) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const label = values.label.trim();
  const slug = createBusinessTagId(values.slug || label);

  if (!label || !slug) {
    throw new Error("Add a tag label before saving.");
  }

  await firestoreModule.setDoc(firestoreModule.doc(db, COLLECTION_NAME, slug), {
    id: slug,
    label,
    slug,
    category: values.category,
    active: true,
    adminOnly: values.adminOnly,
    createdAt: firestoreModule.serverTimestamp(),
    usageCount: 0
  });
}

export async function updateBusinessTag(
  tagId: string,
  values: {
    label: string;
    category: BusinessTagCategory;
    active: boolean;
    adminOnly: boolean;
  }
) {
  const { db, firestoreModule } = await getFirestoreHelpers();

  await firestoreModule.setDoc(
    firestoreModule.doc(db, COLLECTION_NAME, tagId),
    {
      label: values.label.trim(),
      category: values.category,
      active: values.active,
      adminOnly: values.adminOnly
    },
    { merge: true }
  );
}

export async function updateBusinessTagUsageCounts(
  previousTags: unknown,
  nextTags: unknown
) {
  const previous = normalizeTagSlugs(previousTags);
  const next = normalizeTagSlugs(nextTags);
  const addedTags = next.filter((tag) => !previous.includes(tag));
  const removedTags = previous.filter((tag) => !next.includes(tag));

  if (!addedTags.length && !removedTags.length) {
    return;
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const batch = firestoreModule.writeBatch(db);

  for (const tag of addedTags) {
    batch.set(
      firestoreModule.doc(db, COLLECTION_NAME, tag),
      {
        usageCount: firestoreModule.increment(1)
      },
      { merge: true }
    );
  }

  for (const tag of removedTags) {
    batch.set(
      firestoreModule.doc(db, COLLECTION_NAME, tag),
      {
        usageCount: firestoreModule.increment(-1)
      },
      { merge: true }
    );
  }

  await batch.commit();
}

async function commitBusinessTagUpdates(
  updates: Array<{ id: string; tags: string[] }>
) {
  if (!updates.length) {
    return;
  }

  const { db, firestoreModule } = await getFirestoreHelpers();

  for (let index = 0; index < updates.length; index += 450) {
    const batch = firestoreModule.writeBatch(db);
    const chunk = updates.slice(index, index + 450);

    for (const update of chunk) {
      batch.set(
        firestoreModule.doc(db, "businesses", update.id),
        { tags: update.tags },
        { merge: true }
      );
    }

    await batch.commit();
  }
}

export async function recalculateBusinessTagUsageCount(slug: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "businesses"),
      firestoreModule.where("tags", "array-contains", slug)
    )
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(db, COLLECTION_NAME, slug),
    { usageCount: snapshot.size },
    { merge: true }
  );
}

export async function deactivateBusinessTag(tag: BusinessTag) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "businesses"),
      firestoreModule.where("tags", "array-contains", tag.slug)
    )
  );
  const updates = snapshot.docs.map((document) => ({
    id: document.id,
    tags: normalizeTagSlugs(document.data().tags).filter((slug) => slug !== tag.slug)
  }));

  await commitBusinessTagUpdates(updates);
  await firestoreModule.setDoc(
    firestoreModule.doc(db, COLLECTION_NAME, tag.id),
    {
      active: false,
      usageCount: 0
    },
    { merge: true }
  );
}

export async function mergeBusinessTags(source: BusinessTag, target: BusinessTag) {
  if (source.slug === target.slug) {
    throw new Error("Choose two different tags to merge.");
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "businesses"),
      firestoreModule.where("tags", "array-contains", source.slug)
    )
  );
  const updates = snapshot.docs.map((document) => {
    const tags = normalizeTagSlugs(document.data().tags);
    return {
      id: document.id,
      tags: Array.from(
        new Set(tags.map((slug) => (slug === source.slug ? target.slug : slug)))
      )
    };
  });

  await commitBusinessTagUpdates(updates);
  await firestoreModule.deleteDoc(firestoreModule.doc(db, COLLECTION_NAME, source.id));
  await recalculateBusinessTagUsageCount(target.slug);
}
