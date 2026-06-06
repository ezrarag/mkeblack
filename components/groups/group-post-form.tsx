"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { createGroupPost, uploadGroupPostPhotos } from "@/lib/firebase/groups";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { cn } from "@/lib/utils";

export function GroupPostForm({
  groupId,
  authorUid,
  authorName
}: {
  groupId: string;
  authorUid: string;
  authorName: string;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={`Share something with the group, ${authorName.split(" ")[0] || "there"}…`}
        className="w-full resize-none rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
      />

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
