"use client";

import { useState } from "react";
import { removeGroupMember } from "@/lib/firebase/groups";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { GroupMember } from "@/lib/types";

function fmtDate(date: Date | null) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function GroupMembersPanel({
  groupId,
  members,
  selfUid,
  isOwner,
  isAdmin
}: {
  groupId: string;
  members: GroupMember[];
  selfUid: string | null;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = isOwner || isAdmin;

  async function handleRemove(uid: string) {
    if (busyUid) return;
    setBusyUid(uid);
    setError(null);
    try {
      await removeGroupMember(groupId, uid);
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-panel/85 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        Members ({members.length})
      </p>
      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {members.map((member) => (
          <li key={member.uid} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-stone-200">
                {member.displayName}
                {member.uid === selfUid ? <span className="ml-1.5 text-xs text-stone-500">(you)</span> : null}
              </p>
              <p className="text-xs text-stone-500">
                {member.role === "owner" ? "Owner" : "Member"}
                {member.joinedAt ? ` · joined ${fmtDate(member.joinedAt)}` : ""}
              </p>
            </div>
            {canManage && member.role !== "owner" ? (
              <button
                type="button"
                disabled={busyUid === member.uid}
                onClick={() => handleRemove(member.uid)}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-400 transition hover:border-rose-400/40 hover:text-rose-400 disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
