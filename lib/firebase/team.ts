import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import {
  BusinessTeamMember,
  BusinessTeamMemberFormValues,
  TeamMemberRoleType
} from "@/lib/types";
import { normalizeUrl } from "@/lib/utils";

type FirestoreRecord = Record<string, unknown>;

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

/**
 * Derives roleType with full backward compatibility.
 * - New docs have an explicit roleType field.
 * - Legacy docs only have isOwner:true — map those to "owner".
 * - Everything else defaults to "team".
 */
function normalizeRoleType(record: FirestoreRecord): TeamMemberRoleType {
  const rt = record.roleType;
  if (rt === "owner" || rt === "co_owner" || rt === "team") return rt;
  // Legacy: fall back to isOwner boolean
  if (booleanValue(record.isOwner, false)) return "owner";
  return "team";
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);

  if (!db) {
    throw new Error("Firestore is not available in this environment.");
  }

  return { db, firestoreModule };
}

async function getStorageHelpers() {
  const [storageModule, storage] = await Promise.all([
    loadFirebaseStorageModule(),
    getFirebaseStorage()
  ]);

  if (!storage) {
    throw new Error("Firebase Storage is not available in this environment.");
  }

  return { storage, storageModule };
}

export function normalizeBusinessTeamMemberRecord(
  value: unknown,
  id: string
): BusinessTeamMember {
  const record = isRecord(value) ? value : {};
  const roleType = normalizeRoleType(record);

  return {
    id,
    uid: stringValue(record.uid).trim() || null,
    name: stringValue(record.name).trim(),
    role: stringValue(record.role).trim(),
    roleType,
    title: stringValue(record.title).trim(),
    pronouns: stringValue(record.pronouns).trim(),
    bio: stringValue(record.bio).trim().slice(0, 400),
    photoUrl: stringValue(record.photoUrl).trim(),
    linkedinUrl: stringValue(record.linkedinUrl).trim(),
    instagramUrl: stringValue(record.instagramUrl).trim(),
    facebookUrl: stringValue(record.facebookUrl).trim(),
    tiktokUrl: stringValue(record.tiktokUrl).trim(),
    email: stringValue(record.email).trim(),
    phone: stringValue(record.phone).trim(),
    website: stringValue(record.website).trim(),
    displayContact: booleanValue(record.displayContact, false),
    order: numberValue(record.order),
    isOwner: roleType === "owner", // always derived, never stored raw
    visible: booleanValue(record.visible, true),
    addedAt: parseDateValue(record.addedAt)
  };
}

/** Priority weight for sorting: owner < co_owner < team */
function roleTypePriority(roleType: TeamMemberRoleType): number {
  if (roleType === "owner") return 0;
  if (roleType === "co_owner") return 1;
  return 2;
}

export function sortBusinessTeamMembers(members: BusinessTeamMember[]) {
  return [...members].sort((a, b) => {
    const priorityDiff =
      roleTypePriority(a.roleType) - roleTypePriority(b.roleType);
    if (priorityDiff !== 0) return priorityDiff;
    return a.order - b.order || a.name.localeCompare(b.name);
  });
}

export function createTeamMemberDraft(
  order = 0
): BusinessTeamMemberFormValues {
  return {
    uid: "",
    name: "",
    role: "",
    roleType: "team",
    title: "",
    pronouns: "",
    bio: "",
    photoUrl: "",
    linkedinUrl: "",
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
    email: "",
    phone: "",
    website: "",
    displayContact: false,
    order,
    isOwner: false,
    visible: true
  };
}

export function teamMemberToFormValues(
  member: BusinessTeamMember
): BusinessTeamMemberFormValues {
  return {
    uid: member.uid ?? "",
    name: member.name,
    role: member.role,
    roleType: member.roleType,
    title: member.title,
    pronouns: member.pronouns,
    bio: member.bio,
    photoUrl: member.photoUrl,
    linkedinUrl: member.linkedinUrl,
    instagramUrl: member.instagramUrl,
    facebookUrl: member.facebookUrl,
    tiktokUrl: member.tiktokUrl,
    email: member.email,
    phone: member.phone,
    website: member.website,
    displayContact: member.displayContact,
    order: member.order,
    isOwner: member.isOwner,
    visible: member.visible
  };
}

function normalizeTeamMemberPayload(values: BusinessTeamMemberFormValues) {
  const roleType: TeamMemberRoleType = values.roleType;
  return {
    uid: values.uid.trim() || null,
    name: values.name.trim(),
    role: values.role.trim(),
    roleType,
    title: values.title.trim(),
    pronouns: values.pronouns.trim(),
    bio: values.bio.trim().slice(0, 400),
    photoUrl: values.photoUrl.trim(),
    linkedinUrl: normalizeUrl(values.linkedinUrl.trim()),
    instagramUrl: normalizeUrl(values.instagramUrl.trim()),
    facebookUrl: normalizeUrl(values.facebookUrl.trim()),
    tiktokUrl: normalizeUrl(values.tiktokUrl.trim()),
    email: values.email.trim(),
    phone: values.phone.trim(),
    website: normalizeUrl(values.website.trim()),
    displayContact: Boolean(values.displayContact),
    order: Number(values.order),
    // isOwner kept in sync so legacy reads still work
    isOwner: roleType === "owner",
    visible: Boolean(values.visible)
  };
}

export async function refreshBusinessTeamProfileFlag(businessId: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const visibleSnapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "businesses", businessId, "team"),
      firestoreModule.where("visible", "==", true)
    )
  );

  await firestoreModule.setDoc(
    firestoreModule.doc(db, "businesses", businessId),
    { hasTeamProfiles: !visibleSnapshot.empty },
    { merge: true }
  );
}

export async function saveBusinessTeamMember(
  businessId: string,
  memberId: string | null,
  values: BusinessTeamMemberFormValues
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const collectionReference = firestoreModule.collection(
    db,
    "businesses",
    businessId,
    "team"
  );
  const memberReference = memberId
    ? firestoreModule.doc(db, "businesses", businessId, "team", memberId)
    : firestoreModule.doc(collectionReference);

  const memberSnapshot = await firestoreModule.getDoc(memberReference);
  const payload = normalizeTeamMemberPayload(values);
  const batch = firestoreModule.writeBatch(db);

  if (payload.roleType === "owner") {
    // Demote any other existing owner to co_owner so there is only one primary owner.
    // Co-owners and team members are left unchanged.
    const existingMembersSnapshot = await firestoreModule.getDocs(collectionReference);
    existingMembersSnapshot.docs.forEach((document) => {
      if (document.id !== memberReference.id) {
        const data = document.data();
        // Detect owner using both new roleType field and legacy isOwner boolean
        const existingRoleType: string =
          data.roleType ?? (booleanValue(data.isOwner) ? "owner" : "team");
        if (existingRoleType === "owner") {
          batch.set(
            document.ref,
            { roleType: "co_owner", isOwner: false },
            { merge: true }
          );
        }
      }
    });
  }

  batch.set(
    memberReference,
    {
      id: memberReference.id,
      ...payload,
      addedAt: memberSnapshot.exists()
        ? memberSnapshot.data().addedAt ?? firestoreModule.serverTimestamp()
        : firestoreModule.serverTimestamp()
    },
    { merge: true }
  );

  await batch.commit();
  await refreshBusinessTeamProfileFlag(businessId);

  return memberReference.id;
}

export async function deleteBusinessTeamMember(
  businessId: string,
  member: Pick<BusinessTeamMember, "id" | "photoUrl">
) {
  const [{ db, firestoreModule }, storage] = await Promise.all([
    getFirestoreHelpers(),
    getFirebaseStorage()
  ]);

  if (storage && member.photoUrl) {
    const { storageModule } = await getStorageHelpers();

    try {
      await storageModule.deleteObject(storageModule.ref(storage, member.photoUrl));
    } catch {
      // Ignore storage cleanup failures so Firestore state can still update.
    }
  }

  await firestoreModule.deleteDoc(
    firestoreModule.doc(db, "businesses", businessId, "team", member.id)
  );
  await refreshBusinessTeamProfileFlag(businessId);
}

export async function reorderBusinessTeamMembers(
  businessId: string,
  members: Array<Pick<BusinessTeamMember, "id">>
) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const batch = firestoreModule.writeBatch(db);

  members.forEach((member, index) => {
    batch.set(
      firestoreModule.doc(db, "businesses", businessId, "team", member.id),
      { order: index },
      { merge: true }
    );
  });

  await batch.commit();
}

export async function uploadBusinessTeamPhoto(businessId: string, file: File) {
  const { storage, storageModule } = await getStorageHelpers();
  const timestamp = Date.now();
  const storageReference = storageModule.ref(
    storage,
    `businesses/${businessId}/team-photos/${timestamp}-${sanitizeFilename(file.name)}`
  );
  const snapshot = await storageModule.uploadBytes(storageReference, file);
  return storageModule.getDownloadURL(snapshot.ref);
}
