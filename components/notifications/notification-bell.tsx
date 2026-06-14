"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getFirebaseDb,
  isFirebaseConfigured,
  loadFirebaseFirestoreModule
} from "@/lib/firebase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
  normalizeNotification
} from "@/lib/firebase/notifications";
import { UserNotification } from "@/lib/types";

export function NotificationBell({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !uid) {
      return () => undefined;
    }

    let unsubscribe: () => void = () => undefined;

    async function start() {
      const [firestoreModule, db] = await Promise.all([
        loadFirebaseFirestoreModule(),
        getFirebaseDb()
      ]);
      if (!db) return;

      unsubscribe = firestoreModule.onSnapshot(
        firestoreModule.query(
          firestoreModule.collection(db, "users", uid, "notifications"),
          firestoreModule.orderBy("createdAt", "desc"),
          firestoreModule.limit(10)
        ),
        (snapshot) => {
          const next = snapshot.docs
            .map((doc) => normalizeNotification(doc.data(), doc.id))
            .sort(
              (left, right) =>
                (right.createdAt?.getTime() ?? 0) -
                (left.createdAt?.getTime() ?? 0)
            );
          setNotifications(next);
        }
      );
    }

    void start();
    return () => unsubscribe();
  }, [uid]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panelAlt/70 text-sm text-stone-200 transition hover:border-accent/40 hover:text-accentSoft"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-3 w-80 rounded-2xl border border-line bg-canvas/95 p-3 shadow-glow backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Notifications
            </p>
            <button
              type="button"
              onClick={() => void markAllNotificationsRead(uid)}
              className="text-xs font-semibold text-accentSoft transition hover:text-accent"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href || `/groups/${notification.groupId}`}
                  onClick={() => {
                    setOpen(false);
                    void markNotificationRead(uid, notification.id);
                  }}
                  className={`block rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm transition hover:border-accent/40 ${
                    notification.read ? "text-stone-400" : "font-semibold text-ink"
                  }`}
                >
                  <span className="block text-xs text-accentSoft">
                    {notification.groupName}
                  </span>
                  <span className="mt-1 block leading-6">{notification.text}</span>
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-stone-500">
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
