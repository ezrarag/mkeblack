"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useRef, useState } from "react";
import { GroupForm } from "@/components/groups/group-form";
import { GroupMembersPanel } from "@/components/groups/group-members-panel";
import { GroupPostForm } from "@/components/groups/group-post-form";
import { GroupPostsList } from "@/components/groups/group-posts-list";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { useGroup } from "@/hooks/use-group";
import { useGroupMembers } from "@/hooks/use-group-members";
import { useGroupPosts } from "@/hooks/use-group-posts";
import {
  joinGroup,
  leaveGroup,
  setGroupStatus,
  uploadGroupCoverPhoto
} from "@/lib/firebase/groups";
import { formatFirebaseError } from "@/lib/firebase-errors";

type GroupPageProps = {
  groupId: string;
};

export function GroupPage({ groupId }: GroupPageProps) {
  const { user, profile, hasAdminAccess } = useAuth();
  const { group, loading, error } = useGroup(groupId);
  const { members, count, isMember, isOwner, loading: membersLoading } = useGroupMembers(
    groupId,
    user?.uid ?? null
  );
  const { posts, loading: postsLoading } = useGroupPosts(groupId);

  const [editing, setEditing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const displayName = profile?.displayName || user?.displayName || user?.email || "MKE Black member";

  async function handleJoin() {
    if (!user || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await joinGroup({ groupId, uid: user.uid, displayName });
    } catch (err) {
      setActionError(formatFirebaseError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleLeave() {
    if (!user || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await leaveGroup(groupId, user.uid);
    } catch (err) {
      setActionError(formatFirebaseError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await uploadGroupCoverPhoto(groupId, user.uid, file);
    } catch (err) {
      setActionError(formatFirebaseError(err));
    } finally {
      setActionBusy(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleArchiveToggle() {
    if (!group || actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await setGroupStatus(groupId, group.status === "archived" ? "active" : "archived");
    } catch (err) {
      setActionError(formatFirebaseError(err));
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-[360px] animate-pulse rounded-2xl border border-line bg-panel/70" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <StatePanel
          title="Group unavailable"
          description="This group could not be loaded. It may have been removed or made private."
          action={
            <Link
              href="/groups"
              className="inline-flex rounded-full border border-accent/35 bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              Back to groups
            </Link>
          }
        />
      </div>
    );
  }

  const canManage = isOwner || hasAdminAccess;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-line bg-panel/80 shadow-glow">
        <div className="relative h-44 w-full bg-panelAlt/60 sm:h-56">
          {group.coverPhotoUrl ? (
            <Image src={group.coverPhotoUrl} alt={group.name} fill sizes="100vw" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-5xl">👥</span>
            </div>
          )}
          {isOwner ? (
            <div className="absolute bottom-3 right-3">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={actionBusy}
                className="rounded-full border border-line bg-canvas/80 px-4 py-2 text-xs font-semibold text-stone-200 backdrop-blur transition hover:border-accent/35 hover:text-ink disabled:opacity-60"
              >
                {group.coverPhotoUrl ? "Change cover photo" : "Add cover photo"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="p-6 sm:p-8">
          {group.status !== "active" ? (
            <span className="mb-3 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400">
              {group.status === "archived" ? "Archived" : "Flagged for review"}
            </span>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-black leading-tight text-ink sm:text-4xl">
                {group.name}
              </h1>
              {group.businessId && group.businessName ? (
                <Link
                  href={`/business/${group.businessId}`}
                  className="mt-2 inline-flex rounded-full border border-accent/35 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accentSoft transition hover:bg-accent/15"
                >
                  About {group.businessName}
                </Link>
              ) : null}
              <p className="mt-3 text-sm text-stone-500">
                {membersLoading ? "Loading members…" : `${count} member${count === 1 ? "" : "s"}`} · started by{" "}
                {group.creatorName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!user ? (
                <Link
                  href={`/login?next=/groups/${groupId}`}
                  className="inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
                >
                  Sign in to join
                </Link>
              ) : isOwner ? (
                <span className="inline-flex items-center rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-300">
                  You own this group
                </span>
              ) : isMember ? (
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={actionBusy}
                  className="inline-flex rounded-full border border-line bg-panelAlt/70 px-5 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-rose-400/40 hover:text-rose-400 disabled:opacity-60"
                >
                  {actionBusy ? "Leaving…" : "Leave group"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={actionBusy}
                  className="inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
                >
                  {actionBusy ? "Joining…" : "Join group"}
                </button>
              )}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setEditing((current) => !current)}
                  className="inline-flex rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
                >
                  {editing ? "Close" : "Edit group"}
                </button>
              ) : null}
              {hasAdminAccess ? (
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  disabled={actionBusy}
                  className="inline-flex rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-stone-400 transition hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-60"
                >
                  {group.status === "archived" ? "Restore" : "Archive"}
                </button>
              ) : null}
            </div>
          </div>

          {actionError ? <p className="mt-3 text-xs text-rose-400">{actionError}</p> : null}

          {group.description ? (
            <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">{group.description}</p>
          ) : null}
        </div>
      </div>

      {editing && canManage ? (
        <div className="mt-6">
          <GroupForm
            authorUid={group.creatorUid}
            authorName={group.creatorName}
            existingGroup={group}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Group feed
          </p>
          {user && isMember ? (
            <GroupPostForm groupId={groupId} authorUid={user.uid} authorName={displayName} />
          ) : user ? (
            <div className="rounded-2xl border border-line bg-panel/60 px-5 py-4 text-sm text-stone-400">
              Join this group to post and join the conversation.
            </div>
          ) : null}

          {postsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-panel/60" />
              ))}
            </div>
          ) : (
            <GroupPostsList
              posts={posts}
              selfUid={user?.uid ?? null}
              isOwner={isOwner}
              isAdmin={hasAdminAccess}
            />
          )}
        </div>

        <div>
          <GroupMembersPanel
            groupId={groupId}
            members={members}
            selfUid={user?.uid ?? null}
            isOwner={isOwner}
            isAdmin={hasAdminAccess}
          />
        </div>
      </div>
    </section>
  );
}
