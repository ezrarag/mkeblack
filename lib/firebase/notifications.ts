import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import {
  NotificationPrefs,
  NotificationType,
  UserNotification
} from "@/lib/types";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  group_post: true,
  group_mention: true,
  group_event: true,
  group_member_joined: true
};

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDateValue(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }

  return null;
}

function getPrefs(value: unknown): NotificationPrefs {
  const record = isRecord(value) ? value : {};
  return {
    group_post:
      typeof record.group_post === "boolean"
        ? record.group_post
        : DEFAULT_NOTIFICATION_PREFS.group_post,
    group_mention:
      typeof record.group_mention === "boolean"
        ? record.group_mention
        : DEFAULT_NOTIFICATION_PREFS.group_mention,
    group_event:
      typeof record.group_event === "boolean"
        ? record.group_event
        : DEFAULT_NOTIFICATION_PREFS.group_event,
    group_member_joined:
      typeof record.group_member_joined === "boolean"
        ? record.group_member_joined
        : DEFAULT_NOTIFICATION_PREFS.group_member_joined
  };
}

export function normalizeNotification(
  data: Record<string, unknown>,
  id: string
): UserNotification {
  return {
    id,
    type: String(data.type ?? "group_post") as NotificationType,
    groupId: String(data.groupId ?? ""),
    groupName: String(data.groupName ?? ""),
    actorUid: String(data.actorUid ?? ""),
    actorName: String(data.actorName ?? ""),
    targetId: String(data.targetId ?? ""),
    text: String(data.text ?? ""),
    href: String(data.href ?? ""),
    read: data.read === true,
    createdAt: parseDateValue(data.createdAt)
  };
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

export function parseMentionUids(text: string) {
  return Array.from(text.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g))
    .map((match) => match[2])
    .filter(Boolean);
}

export async function writeGroupNotifications(params: {
  type: NotificationType;
  groupId: string;
  groupName: string;
  actorUid: string;
  actorName: string;
  targetId: string;
  text: string;
  recipientUids?: string[];
}) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const membersSnapshot = await firestoreModule.getDocs(
    firestoreModule.collection(db, "groups", params.groupId, "members")
  );
  const memberUids = membersSnapshot.docs
    .map((doc) => doc.id)
    .filter((uid) => uid !== params.actorUid);
  const explicitRecipients = params.recipientUids
    ? new Set(params.recipientUids.filter((uid) => uid !== params.actorUid))
    : null;
  const recipientUids = explicitRecipients
    ? memberUids.filter((uid) => explicitRecipients.has(uid))
    : memberUids;

  if (!recipientUids.length) {
    return;
  }

  const userSnapshots = await Promise.all(
    recipientUids.map((uid) => firestoreModule.getDoc(firestoreModule.doc(db, "users", uid)))
  );
  const batch = firestoreModule.writeBatch(db);

  // This client-side fan-out is acceptable at current group sizes; move it to
  // a Cloud Function if groups become large or notifications need retries.
  userSnapshots.forEach((snapshot, index) => {
    const uid = recipientUids[index];
    const prefs = getPrefs(snapshot.data()?.notificationPrefs);
    if (!prefs[params.type]) {
      return;
    }

    const ref = firestoreModule.doc(
      firestoreModule.collection(db, "users", uid, "notifications")
    );
    batch.set(ref, {
      id: ref.id,
      type: params.type,
      groupId: params.groupId,
      groupName: params.groupName,
      actorUid: params.actorUid,
      actorName: params.actorName,
      targetId: params.targetId,
      text: params.text.slice(0, 180),
      href: `/groups/${params.groupId}`,
      read: false,
      createdAt: firestoreModule.serverTimestamp()
    });
  });

  await batch.commit();
}

export async function markNotificationRead(uid: string, notificationId: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  await firestoreModule.setDoc(
    firestoreModule.doc(db, "users", uid, "notifications", notificationId),
    { read: true },
    { merge: true }
  );
}

export async function markAllNotificationsRead(uid: string) {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, "users", uid, "notifications"),
      firestoreModule.where("read", "==", false),
      firestoreModule.limit(50)
    )
  );
  const batch = firestoreModule.writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.set(doc.ref, { read: true }, { merge: true });
  });
  await batch.commit();
}
