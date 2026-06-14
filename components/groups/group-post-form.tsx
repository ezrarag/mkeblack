"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { createGroupPost, uploadGroupPostPhotos } from "@/lib/firebase/groups";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { GroupMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GroupPostForm({
  groupId,
  authorUid,
  authorName,
  members
}: {
  groupId: string;
  authorUid: string;
  authorName: string;
  members: GroupMember[];
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const activeMention = /(^|\s)@([^\s@]*)$/.exec(text);
  const mentionQuery = activeMention?.[2]?.toLowerCase() ?? "";
  const mentionOptions = useMemo(() => {
    if (!activeMention) return [];
    return members
      .filter((member) => member.uid !== authorUid)
      .filter((member) =>
        member.displayName.toLowerCase().includes(mentionQuery)
      )
      .slice(0, 6);
  }, [activeMention, authorUid, members, mentionQuery]);

  function insertMention(member: GroupMember) {
    const match = /(^|\s)@([^\s@]*)$/.exec(text);
    if (!match) return;
    const start = match.index + match[1].length;
    const nextText = `${text.slice(0, start)}@[${member.displayName}](${member.uid}) `;
    setText(nextText);
    setMentionIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOptions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionIndex((current) => (current + 1) % mentionOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionIndex(
        (current) => (current - 1 + mentionOptions.length) % mentionOptions.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertMention(mentionOptions[mentionIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMentionIndex(0);
      setText((current) => current.replace(/(^|\s)@([^\s@]*)$/, "$1"));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (posting) return;
    if (!text.trim() && !files.length) {
      setError("Write something or add a photo before posting.");
      return;
    }

    setPosting(true);
    setError(null);
    try {
      const photos = files.length ? await uploadGroupPostPhotos(groupId, authorUid, files) : [];
      await createGroupPost({ groupId, authorUid, authorName, text, photos });
      setText("");
      setFiles([]);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panelAlt/50 p-5">
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setMentionIndex(0);
        }}
        onKeyDown={handleKeyDown}
        rows={3}
        maxLength={4000}
        placeholder={`Share something with the group, ${authorName.split(" ")[0] || "there"}…`}
        className="w-full resize-none rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
      />

      {mentionOptions.length ? (
        <div className="mt-2 rounded-xl border border-line bg-canvas/95 p-2 shadow-glow">
          {mentionOptions.map((member, index) => (
            <button
              key={member.uid}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                insertMention(member);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                index === mentionIndex
                  ? "bg-accent/15 text-accentSoft"
                  : "text-stone-200 hover:bg-panelAlt"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-panelAlt text-[10px] font-bold uppercase">
                {member.displayName.slice(0, 2)}
              </span>
              <span>{member.displayName}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          className="block text-sm text-stone-300 file:mr-4 file:rounded-full file:border file:border-accent/40 file:bg-accent/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-accentSoft file:transition hover:file:bg-accent/15"
        />
        <button
          type="submit"
          disabled={posting}
          className={cn(
            "inline-flex shrink-0 rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
          )}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>

      {files.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line">
              <Image
                src={URL.createObjectURL(file)}
                alt={file.name}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
    </form>
  );
}
