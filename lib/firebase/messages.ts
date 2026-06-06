import {
  getFirebaseDb,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import { Message, MessageSenderRole, MessageThread } from "@/lib/types";

type FirestoreRecord = Record<string, unknown>;

function isRecord(value: unknown): value is FirestoreRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function senderRoleValue(value: unknown): MessageSenderRole {
  return value === "business" || value === "admin" ? value : "visitor";
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (
    isRecord(value) &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  return null;
}

async function getFirestoreHelpers() {
  const [firestoreModule, db] = await Promise.all([
    loadFirebaseFirestoreModule(),
    getFirebaseDb()
  ]);
  if (!db) throw new Error("Firestore is not available.");
  return { db, firestoreModule };
}

export function normalizeMessageThread(data: FirestoreRecord, id: string): MessageThread {
  return {
    id,
    businessId: stringValue(data.businessId),
    businessName: stringValue(data.businessName),
    businessPhotoUrl: stringValue(data.businessPhotoUrl),
    visitorUid: stringValue(data.visitorUid),
    visitorName: stringValue(data.visitorName, "MKE Black member"),
    lastMessage: stringValue(data.lastMessage),
    lastMessageAt: parseDateValue(data.lastMessageAt),
    lastSenderRole: data.lastSenderRole ? senderRoleValue(data.lastSenderRole) : null,
    visitorUnread: numberValue(data.visitorUnread),
    businessUnread: numberValue(data.businessUnread),
    createdAt: parseDateValue(data.createdAt)
  };
}

export function normalizeMessage(data: FirestoreRecord, id: string, threadId: string): Message {
  return {
    id,
    threadId,
    senderId: stringValue(data.senderId),
    senderRole: senderRoleValue(data.senderRole),
    senderName: stringValue(data.senderName, "MKE Black member"),
    text: stringValue(data.text),
    createdAt: parseDateValue(data.createdAt)
  };
}

/**
 * Finds an existing thread between this visitor and business, or creates one.
 * Threads are keyed deterministically as `${businessId}_${visitorUid}` so
 * repeat lookups never create duplicates.
 */
export async function getOrCreateThread(params: {
  businessId: string;
  businessName: string;
  businessPhotoUrl?: string;
  visitorUid: string;
  visitorName: string;
}): Promise<string> {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const threadId = `${params.businessId}_${params.visitorUid}`;
  const ref = firestoreModule.doc(db, "message_threads", threadId);
  const snapshot = await firestoreModule.getDoc(ref);

  if (!snapshot.exists()) {
    await firestoreModule.setDoc(ref, {
      businessId: params.businessId,
      businessName: params.businessName,
      businessPhotoUrl: params.businessPhotoUrl ?? "",
      visitorUid: params.visitorUid,
      visitorName: params.visitorName,
      lastMessage: "",
      lastMessageAt: null,
      lastSenderRole: null,
      visitorUnread: 0,
      businessUnread: 0,
      createdAt: firestoreModule.serverTimestamp()
    });
  }

  return threadId;
}

/**
 * Sends a message into a thread and updates the thread's preview/unread
 * counters in one batched write so the inbox list stays in sync.
 */
export async function sendMessage(params: {
  threadId: string;
  senderId: string;
  senderRole: MessageSenderRole;
  senderName: string;
  text: string;
}): Promise<void> {
  const trimmed = params.text.trim();
  if (!trimmed) return;

  const { db, firestoreModule } = await getFirestoreHelpers();
  const threadRef = firestoreModule.doc(db, "message_threads", params.threadId);
  const messagesRef = firestoreModule.collection(threadRef, "messages");
  const messageRef = firestoreModule.doc(messagesRef);

  const batch = firestoreModule.writeBatch(db);
  batch.set(messageRef, {
    senderId: params.senderId,
    senderRole: params.senderRole,
    senderName: params.senderName,
    text: trimmed,
    createdAt: firestoreModule.serverTimestamp()
  });

  const isFromVisitor = params.senderRole === "visitor";
  batch.set(
    threadRef,
    {
      lastMessage: trimmed,
      lastMessageAt: firestoreModule.serverTimestamp(),
      lastSenderRole: params.senderRole,
      // Increment the unread count for the *other* party; reset the sender's.
      visitorUnread: isFromVisitor
        ? 0
        : firestoreModule.increment(1),
      businessUnread: isFromVisitor
        ? firestoreModule.increment(1)
        : 0
    },
    { merge: true }
  );

  await batch.commit();
}

/**
 * Marks a thread as read for the given side — zeroes out that party's
 * unread counter. Called when the thread is opened.
 */
export async function markThreadRead(threadId: string, role: "visitor" | "business") {
  const { db, firestoreModule } = await getFirestoreHelpers();
  const ref = firestoreModule.doc(db, "message_threads", threadId);
  await firestoreModule.setDoc(
    ref,
    role === "visitor" ? { visitorUnread: 0 } : { businessUnread: 0 },
    { merge: true }
  );
}
