import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { createBusinessCategoryId } from "@/lib/categories";
import { BusinessCategoryOption } from "@/lib/types";

const COLLECTION_NAME = "business_categories";

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

export function normalizeBusinessCategoryRecord(
  value: unknown,
  id: string
): BusinessCategoryOption {
  const record = isRecord(value) ? value : {};
  const label =
    typeof record.label === "string" && record.label.trim()
      ? record.label.trim()
      : id;
  const slug =
    typeof record.slug === "string" && record.slug.trim()
      ? record.slug.trim()
      : createBusinessCategoryId(label);

  return {
    id,
    label,
    slug,
    active: typeof record.active === "boolean" ? record.active : true,
    createdAt: parseDateValue(record.createdAt),
    usageCount:
      typeof record.usageCount === "number" && Number.isFinite(record.usageCount)
        ? record.usageCount
        : 0
  };
}

export function sortBusinessCategories(categories: BusinessCategoryOption[]) {
  return [...categories].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

export async function addBusinessCategory(values: {
  label: string;
  slug?: string;
}) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const label = values.label.trim();
  const slug = createBusinessCategoryId(values.slug || label);

  if (!label || !slug) {
    throw new Error("Add a category label before saving.");
  }

  await firestoreModule.setDoc(firestoreModule.doc(db, COLLECTION_NAME, slug), {
    id: slug,
    label,
    slug,
    active: true,
    createdAt: firestoreModule.serverTimestamp(),
    usageCount: 0
  });

  await recalculateBusinessCategoryUsageCount(label);
}

export async function updateBusinessCategory(
  categoryId: string,
  values: {
    label: string;
    active: boolean;
  }
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const label = values.label.trim();

  if (!label) {
    throw new Error("Category label is required.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, COLLECTION_NAME, categoryId),
    {
      label,
      active: values.active
    },
    { merge: true }
  );

  await recalculateBusinessCategoryUsageCount(label);
}

export async function updateBusinessCategoryUsageCounts(
  previousCategory: unknown,
  nextCategory: unknown
) {
  const previous =
    typeof previousCategory === "string" ? previousCategory.trim() : "";
  const next = typeof nextCategory === "string" ? nextCategory.trim() : "";

  if (previous === next) {
    return;
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const batch = firestoreModule.writeBatch(db);

  if (previous) {
    batch.set(
      firestoreModule.doc(db, COLLECTION_NAME, createBusinessCategoryId(previous)),
      {
        label: previous,
        slug: createBusinessCategoryId(previous),
        usageCount: firestoreModule.increment(-1)
      },
      { merge: true }
    );
  }

  if (next) {
    batch.set(
      firestoreModule.doc(db, COLLECTION_NAME, createBusinessCategoryId(next)),
      {
        label: next,
        slug: createBusinessCategoryId(next),
        active: true,
        usageCount: firestoreModule.increment(1)
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function recalculateBusinessCategoryUsageCount(label: string) {
  const normalizedLabel = label.trim();

  if (!normalizedLabel) {
    return;
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "businesses"),
      firestoreModule.where("category", "==", normalizedLabel)
    )
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(db, COLLECTION_NAME, createBusinessCategoryId(normalizedLabel)),
    {
      label: normalizedLabel,
      slug: createBusinessCategoryId(normalizedLabel),
      usageCount: snapshot.size
    },
    { merge: true }
  );
}

export async function deactivateBusinessCategory(category: BusinessCategoryOption) {
  const { db, firestoreModule } = await getFirestoreHelpers();

  if (category.usageCount > 0) {
    throw new Error("Merge or reassign businesses before deactivating this category.");
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(db, COLLECTION_NAME, category.id),
    { active: false },
    { merge: true }
  );
}

export async function mergeBusinessCategories(
  source: BusinessCategoryOption,
  target: BusinessCategoryOption
) {
  if (source.id === target.id) {
    throw new Error("Choose two different categories to merge.");
  }

  const { db, firestoreModule } = await getFirestoreHelpers();
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "businesses"),
      firestoreModule.where("category", "==", source.label)
    )
  );

  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = firestoreModule.writeBatch(db);
    const chunk = snapshot.docs.slice(index, index + 450);

    for (const document of chunk) {
      batch.set(document.ref, { category: target.label }, { merge: true });
    }

    await batch.commit();
  }

  await Promise.all([
    firestoreModule.setDoc(
      firestoreModule.doc(db, COLLECTION_NAME, source.id),
      { active: false, usageCount: 0 },
      { merge: true }
    ),
    recalculateBusinessCategoryUsageCount(target.label)
  ]);
}
