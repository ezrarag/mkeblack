import {
  getFirebaseDb,
  getFirebaseStorage,
  loadFirebaseFirestoreModule,
  loadFirebaseStorageModule
} from "@/lib/firebase/client";
import {
  Group,
  GroupMember,
  GroupMemberRole,
  GroupPost,
  GroupPostStatus,
  GroupStatus
} from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function groupStatusValue(value: unknown): GroupStatus {
  return value === "archived" || value === "flagged" ? value : "active";
}

function groupPostStatusValue(value: unknown): GroupPostStatus {
  return value === "flagged" || value === "removed" ? value : "published";
}

function memberRoleValue(value: unknown): GroupMemberRole {
  return value === "owner" ? "owner" : "member";
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (
    isRecord(value) &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]+/g, "-").toLowerCase();
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

async function getStorageHelpers() {
  const [storageModule, storage] = await Promise.all([
    loadFirebaseStorageModule(),
    getFirebaseStorage()
  ]);
  if (!storage) throw new Error("Firebase Storage is not available.");
  return { storage, storageModule };
}

export function normalizeGroup(value: unknown, id: string): Group {
  const record = isRecord(value) ? value : {};
  const businessId = stringValue(record.businessId).trim();
  const businessName = stringValue(record.businessName).trim();

  return {
    id,
    name: stringValue(record.name).trim(),
    description: stringValue(record.description).trim(),
    businessId: businessId || null,
    businessName: businessId ? businessName || null : null,
    coverPhotoUrl: stringValue(record.coverPhotoUrl).trim(),
    creatorUid: stringValue(record.creatorUid).trim(),
    creatorName: stringValue(record.creatorName, "MKE Black member").trim(),
    status: groupStatusValue(record.status),
    createdAt: parseDateValue(record.createdAt),
    updatedAt: parseDateValue(record.updatedAt)
  };
}

export function normalizeGroupMember(value: unknown, uid: string, groupId: string): GroupMember {
  const record = isRecord(value) ? value : {};
  return {
    uid,
    groupId,
    displayName: stringValue(record.displayName, "MKE Black member").trim(),
    role: memberRoleValue(record.role),
    joinedAt: parseDateValue(record.joinedAt)
  };
}

export function normalizeGroupPost(value: unknown, id: string, groupId: string): GroupPost {
  const record = isRecord(value) ? value : {};
  return {
    id,
    groupId,
    authorUid: stringValue(record.authorUid).trim(),
    authorName: stringValue(record.authorName, "MKE Black member").trim(),
    text: stringValue(record.text),
    photos: stringArrayValue(record.photos),
    likeUids: stringArrayValue(record.likeUids),
    status: groupPostStatusValue(record.status),
    createdAt: parseDateValue(record.createdAt),
    updatedAt: parseDateValue(record.updatedAt)
  };
}

/**
 * Creates a new visitor-run community group and seats the creator as its
 * owner in one batched write — mirrors the deterministic-membership pattern
 * used elsewhere (`${groupId}/members/${uid}`) so a person can never join
 * the same group twice.
 */
export async function createGroup(params: {
  name: string;
  description: string;
  businessId: string | null;
  businessName: string | null;
  creatorUid: string;
  creatorName: string;
}): Promise<string> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const name = params.name.trim();
  const description = params.description.trim();

  if (!name) throw new Error("Give your group a name.");
  if (name.length > 80) throw new Error("Group names must be 80 characters or fewer.");
  if (description.length > 1000) throw new Error("Descriptions must be 1000 characters or fewer.");

  const groupRef = firestoreModule.doc(firestoreModule.collection(db, "groups"));
  const memberRef = firestoreModule.doc(db, "groups", groupRef.id, "members", params.creatorUid);

  // Two sequential writes, not a batch: the member-doc create rule looks up
  // the group's creatorUid via get() to confirm "owner" status, and that
  // get() can't see a sibling write still pending in the same batch — the
  // group doc must already exist by the time the member doc is created.
  await firestoreModule.setDoc(groupRef, {
    name,
    description,
    businessId: params.businessId || "",
    businessName: params.businessId ? params.businessName || "" : "",
    coverPhotoUrl: "",
    creatorUid: params.creatorUid,
    creatorName: params.creatorName,
    status: "active",
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp()
  });

  await firestoreModule.setDoc(memberRef, {
    displayName: params.creatorName,
    role: "owner",
    joinedAt: firestoreModule.serverTimestamp()
  });

  return groupRef.id;
}

/**
 * Owner-editable fields. `creatorUid`, `status`, and timestamps are
 * intentionally excluded — those are admin/system controlled.
 */
export async function updateGroup(
  groupId: string,
  updates: { name: string; description: string; businessId: string | null; businessName: string | null }
): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const name = updates.name.trim();
  const description = updates.description.trim();

  if (!name) throw new Error("Give your group a name.");
  if (name.length > 80) throw new Error("Group names must be 80 characters or fewer.");
  if (description.length > 1000) throw new Error("Descriptions must be 1000 characters or fewer.");

  await firestoreModule.updateDoc(firestoreModule.doc(db, "groups", groupId), {
    name,
    description,
    businessId: updates.businessId || "",
    businessName: updates.businessId ? updates.businessName || "" : "",
    updatedAt: firestoreModule.serverTimestamp()
  });
}

export async function uploadGroupCoverPhoto(groupId: string, uid: string, file: File): Promise<string> {
  const { storage, storageModule } = await getStorageHelpers();
  const path = `groups/${groupId}/cover/${uid}-${Date.now()}-${sanitizeFilename(file.name)}`;
  const ref = storageModule.ref(storage, path);
  await storageModule.uploadBytes(ref, file);
  const url = await storageModule.getDownloadURL(ref);

  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.updateDoc(firestoreModule.doc(db, "groups", groupId), {
    coverPhotoUrl: url,
    updatedAt: firestoreModule.serverTimestamp()
  });

  return url;
}

/** Admin moderation — flag, archive, or restore a group. */
export async function setGroupStatus(groupId: string, status: GroupStatus): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.updateDoc(firestoreModule.doc(db, "groups", groupId), {
    status,
    updatedAt: firestoreModule.serverTimestamp()
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "groups", groupId));
}

/** Joins a group. Deterministic doc id (`uid`) prevents duplicate membership. */
export async function joinGroup(params: { groupId: string; uid: string; displayName: string }): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const ref = firestoreModule.doc(db, "groups", params.groupId, "members", params.uid);
  await firestoreModule.setDoc(ref, {
    displayName: params.displayName,
    role: "member",
    joinedAt: firestoreModule.serverTimestamp()
  });
}

/** Leaves a group. Owners can't leave — they must archive or hand the group to an admin. */
export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const ref = firestoreModule.doc(db, "groups", groupId, "members", uid);
  const snapshot = await firestoreModule.getDoc(ref);
  if (snapshot.exists() && snapshot.data()?.role === "owner") {
    throw new Error("As the group's creator, you can't leave it. Archive the group instead.");
  }
  await firestoreModule.deleteDoc(ref);
}

/** Owner/admin removes a member from the group. */
export async function removeGroupMember(groupId: string, uid: string): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "groups", groupId, "members", uid));
}

export async function uploadGroupPostPhotos(
  groupId: string,
  authorUid: string,
  files: File[]
): Promise<string[]> {
  if (!files.length) return [];
  const { storage, storageModule } = await getStorageHelpers();

  const urls = await Promise.all(
    files.map(async (file) => {
      const path = `groups/${groupId}/posts/${authorUid}/${Date.now()}-${sanitizeFilename(file.name)}`;
      const ref = storageModule.ref(storage, path);
      await storageModule.uploadBytes(ref, file);
      return storageModule.getDownloadURL(ref);
    })
  );

  return urls;
}

export async function createGroupPost(params: {
  groupId: string;
  authorUid: string;
  authorName: string;
  text: string;
  photos: string[];
}): Promise<string> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const text = params.text.trim();

  if (!text && !params.photos.length) {
    throw new Error("Write something or add a photo before posting.");
  }
  if (text.length > 4000) {
    throw new Error("Posts must be 4000 characters or fewer.");
  }

  const ref = firestoreModule.doc(
    firestoreModule.collection(db, "groups", params.groupId, "posts")
  );

  await firestoreModule.setDoc(ref, {
    authorUid: params.authorUid,
    authorName: params.authorName,
    text,
    photos: params.photos,
    likeUids: [],
    status: "published",
    createdAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp()
  });

  return ref.id;
}

export async function deleteGroupPost(groupId: string, postId: string): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.deleteDoc(firestoreModule.doc(db, "groups", groupId, "posts", postId));
}

/** Admin/owner moderation — flag, restore, or remove a post. */
export async function setGroupPostStatus(
  groupId: string,
  postId: string,
  status: GroupPostStatus
): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.updateDoc(firestoreModule.doc(db, "groups", groupId, "posts", postId), {
    status,
    updatedAt: firestoreModule.serverTimestamp()
  });
}

export async function toggleGroupPostLike(
  groupId: string,
  postId: string,
  uid: string,
  liked: boolean
): Promise<void> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.updateDoc(firestoreModule.doc(db, "groups", groupId, "posts", postId), {
    likeUids: liked ? firestoreModule.arrayUnion(uid) : firestoreModule.arrayRemove(uid),
    updatedAt: firestoreModule.serverTimestamp()
  });
}
