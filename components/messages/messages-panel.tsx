"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { useMessageThreads } from "@/hooks/use-message-threads";
import { useThreadMessages } from "@/hooks/use-thread-messages";
import { markThreadRead, sendMessage } from "@/lib/firebase/messages";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { MessageThread } from "@/lib/types";

type Side = "visitor" | "business";

function fmtTime(date: Date | null) {
  if (!date) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function otherPartyName(thread: MessageThread, side: Side) {
  return side === "visitor" ? thread.businessName : thread.visitorName;
}

function unreadFor(thread: MessageThread, side: Side) {
  return side === "visitor" ? thread.visitorUnread : thread.businessUnread;
}

function ThreadList({
  threads,
  side,
  selectedId,
  onSelect
}: {
  threads: MessageThread[];
  side: Side;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!threads.length) {
    return (
      <div className="rounded-2xl border border-line bg-panel/60 px-6 py-10 text-center">
        <p className="text-3xl">💬</p>
        <p className="mt-3 font-display text-lg font-bold text-ink">
          No conversations yet
        </p>
        <p className="mt-1 text-sm text-stone-400">
          {side === "visitor"
            ? "Message a Solidarity Circle business from their listing to ask about products, events, or prices."
            : "Visitor messages about your marketplace listings and events will show up here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => {
        const unread = unreadFor(thread, side);
        const selected = thread.id === selectedId;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              selected
                ? "border-accent/50 bg-accent/10"
                : "border-line bg-panelAlt/60 hover:border-accent/30 hover:bg-accent/5"
            }`}
          >
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-line bg-panel">
              {side === "visitor" && thread.businessPhotoUrl ? (
                <Image
                  src={thread.businessPhotoUrl}
                  alt={otherPartyName(thread, side)}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-display text-sm font-black text-stone-500">
                  {otherPartyName(thread, side).slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {otherPartyName(thread, side)}
                </p>
                <span className="shrink-0 text-[11px] text-stone-500">
                  {fmtTime(thread.lastMessageAt)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-stone-400">
                {thread.lastMessage || "Say hello…"}
              </p>
            </div>
            {unread > 0 ? (
              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function Conversation({
  thread,
  side,
  selfId,
  selfName
}: {
  thread: MessageThread;
  side: Side;
  selfId: string;
  selfName: string;
}) {
  const { messages, loading } = useThreadMessages(thread.id);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void markThreadRead(thread.id, side);
  }, [thread.id, side]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({
        threadId: thread.id,
        senderId: selfId,
        senderRole: side,
        senderName: selfName,
        text
      });
      setDraft("");
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel/80">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-line bg-panelAlt">
          {side === "visitor" && thread.businessPhotoUrl ? (
            <Image
              src={thread.businessPhotoUrl}
              alt={otherPartyName(thread, side)}
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-sm font-black text-stone-500">
              {otherPartyName(thread, side).slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{otherPartyName(thread, side)}</p>
          {side === "business" ? (
            <p className="truncate text-xs text-stone-500">Visitor • MKE Black member</p>
          ) : (
            <p className="truncate text-xs text-stone-500">Solidarity Circle business</p>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-2/3 animate-pulse rounded-2xl bg-panelAlt/60" />
            ))}
          </div>
        ) : messages.length ? (
          messages.map((message) => {
            const isSelf = message.senderId === selfId;
            return (
              <div
                key={message.id}
                className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                    isSelf
                      ? "bg-accent text-white"
                      : "border border-line bg-panelAlt/70 text-stone-100"
                  }`}
                >
                  <p>{message.text}</p>
                  <p
                    className={`mt-1 text-[10px] uppercase tracking-[0.12em] ${
                      isSelf ? "text-white/70" : "text-stone-500"
                    }`}
                  >
                    {fmtTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-10 text-center text-sm text-stone-500">
            No messages yet — say hello 👋
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-line p-4">
        {error ? <p className="mb-2 text-xs text-rose-400">{error}</p> : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as FormEvent);
              }
            }}
            placeholder="Write a message…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-panelAlt/70 px-4 py-2.5 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function MessagesPanel({
  side,
  selfId,
  selfName,
  threadKey
}: {
  side: Side;
  /** uid of the signed-in person sending messages from this view */
  selfId: string;
  selfName: string;
  /** visitorUid for the visitor side, businessId for the business side */
  threadKey: string | null;
}) {
  const { threads, loading, error } = useMessageThreads(side, threadKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && threads.length) {
      setSelectedId(threads[0].id);
    }
  }, [threads, selectedId]);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  if (error) {
    return <StatePanel title="Couldn't load messages" description={error} />;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-panel/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <ThreadList
        threads={threads}
        side={side}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <div className="min-h-[420px] lg:h-[560px]">
        {selected ? (
          <Conversation thread={selected} side={side} selfId={selfId} selfName={selfName} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-line bg-panel/60 text-sm text-stone-500">
            Select a conversation to view messages.
          </div>
        )}
      </div>
    </div>
  );
}
