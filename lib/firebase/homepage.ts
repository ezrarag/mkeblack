import {
  collection,
  doc,
  setDoc,
  writeBatch
} from "firebase/firestore";
import {
  createHomepageModuleDraft,
  createMemberDiscountDraft,
  serializeHomepageModule,
  serializeMemberDiscount
} from "@/lib/homepage";
import { getFirebaseDb } from "@/lib/firebase/client";
import { HomepageModule, HomepageModuleType, MemberDiscount } from "@/lib/types";

function getDbOrThrow() {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  return db;
}

export async function saveHomepageModule(
  moduleId: string,
  module: HomepageModule
) {
  const db = getDbOrThrow();

  await setDoc(doc(db, "homepage_modules", moduleId), serializeHomepageModule(module), {
    merge: true
  });
}

export async function createHomepageModule(
  type: HomepageModuleType,
  order: number
) {
  const db = getDbOrThrow();
  const moduleReference = doc(collection(db, "homepage_modules"));
  const draft = createHomepageModuleDraft(type);

  await saveHomepageModule(moduleReference.id, {
    ...draft,
    id: moduleReference.id,
    order
  });

  return moduleReference.id;
}

export async function saveHomepageModuleArrangement(
  modules: Array<Pick<HomepageModule, "id" | "visible" | "order">>
) {
  const db = getDbOrThrow();
  const batch = writeBatch(db);

  modules.forEach((module) => {
    batch.set(
      doc(db, "homepage_modules", module.id),
      {
        id: module.id,
        visible: module.visible,
        order: module.order
      },
      { merge: true }
    );
  });

  await batch.commit();
}

export async function saveMemberDiscount(
  discountId: string,
  discount: MemberDiscount
) {
  const db = getDbOrThrow();

  await setDoc(
    doc(db, "member_discounts", discountId),
    serializeMemberDiscount(discount),
    { merge: true }
  );
}

export async function createMemberDiscount(order: number) {
  const db = getDbOrThrow();
  const discountReference = doc(collection(db, "member_discounts"));
  const draft = createMemberDiscountDraft();

  await saveMemberDiscount(discountReference.id, {
    ...draft,
    id: discountReference.id,
    order
  });

  return discountReference.id;
}

export async function saveMemberDiscountArrangement(
  discounts: Array<Pick<MemberDiscount, "id" | "active" | "order">>
) {
  const db = getDbOrThrow();
  const batch = writeBatch(db);

  discounts.forEach((discount) => {
    batch.set(
      doc(db, "member_discounts", discount.id),
      {
        id: discount.id,
        active: discount.active,
        order: discount.order
      },
      { merge: true }
    );
  });

  await batch.commit();
}
