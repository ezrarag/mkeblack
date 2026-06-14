"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  deleteGroupPost,
  setGroupPostStatus,
  toggleGroupPostLike
} from "@/lib/firebase/groups";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { GroupPost } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmtDate(date: Date | null) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderPostText(text: string) {
  const parts = text.split(/(@\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, index) => {
    const mention = /^@\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (!mention) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <Link
        key={`${mention[2]}-${index}`}
        href={`/visitor?member=${encodeURIComponent(mention[2])}`}
        className="font-semibold text-accentSoft transition hover:text-accent"
      >
        @{mention[1]}
      </Link>
    );
  });
}

function PostCard({
  post,
  selfUid,
  isOwner,
  isAdmin
}: {
  post: GroupPost;
  selfUid: string | null;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liked = !!selfUid && post.likeUids.includes(selfUid);
  const isAuthor = !!selfUid && post.authorUid === selfUid;

  async function handleLike() {
    if (!selfUid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await toggleGroupPostLike(post.groupId, post.id, selfUid, !liked);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteGroupPost(post.groupId, post.id);
    } catch (err) {
      setError(formatFirebaseError(err));
      setBusy(false);
    }
  }

  async function handleModerate(status: "flagged" | "published") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setGroupPostStatus(post.groupId, post.id, status);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-panelAlt/45 p-5",
        post.status === "flagged" ? "border-amber-500/40" : "border-line"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{post.authorName}</p>
          <p className="mt-0.5 text-xs text-stone-500">{fmtDate(post.createdAt)}</p>
        </div>
        {post.status === "flagged" ? (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">
            Flagged
          </span>
        ) : null}
      </div>

      {post.text ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">
          {renderPostText(post.text)}
        </p>
      ) : null}

      {post.photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.photos.map((photo) => (
            <a
              key={photo}
              href={photo}
              target="_blank"
              rel="noreferrer"
              className="relative block h-24 w-24 overflow-hidden rounded-xl border border-line transition hover:border-accent/40"
            >
              <Image src={photo} alt="Post photo" fill sizes="96px" className="object-cover" />
            </a>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          disabled={!selfUid || busy}
          onClick={handleLike}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
            liked
              ? "border-accent/50 bg-accent/15 text-accentSoft"
              : "border-line text-stone-400 hover:border-accent/35 hover:text-accentSoft"
          )}
        >
          {liked ? "♥ Liked" : "♡ Like"}
          {post.likeUids.length ? ` · ${post.likeUids.length}` : ""}
        </button>
        {isAuthor || isOwner || isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-400 transition hover:border-rose-400/40 hover:text-rose-400 disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
        {(isOwner || isAdmin) && !isAuthor ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleModerate(post.status === "flagged" ? "published" : "flagged")}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-400 transition hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-50"
          >
            {post.status === "flagged" ? "Unflag" : "Flag"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function GroupPostsList({
  posts,
  selfUid,
  isOwner,
  isAdmin
}: {
  posts: GroupPost[];
  selfUid: string | null;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const visible = posts.filter(
    (post) => isAdmin || isOwner || post.status !== "flagged" || post.authorUid === selfUid
  );

  if (!visible.length) {
    return (
      <div className="rounded-2xl border border-line bg-panel/60 px-6 py-10 text-center">
        <p className="text-3xl">📝</p>
        <p className="mt-3 font-display text-lg font-bold text-ink">Nothing posted yet</p>
        <p className="mt-1 text-sm text-stone-400">
          Be the first to share something with this group.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((post) => (
        <PostCard key={post.id} post={post} selfUid={selfUid} isOwner={isOwner} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
