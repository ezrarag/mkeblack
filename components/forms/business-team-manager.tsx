"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useBusinessTeam } from "@/hooks/use-business-team";
import {
  createTeamMemberDraft,
  deleteBusinessTeamMember,
  reorderBusinessTeamMembers,
  saveBusinessTeamMember,
  teamMemberToFormValues,
  uploadBusinessTeamPhoto
} from "@/lib/firebase/team";
import { formatFirebaseError } from "@/lib/firebase-errors";
import {
  BusinessTeamMember,
  BusinessTeamMemberFormValues,
  TeamMemberRoleType
} from "@/lib/types";

type BusinessTeamManagerProps = {
  businessId: string;
  showUidField?: boolean;
};

const ROLE_TYPE_OPTIONS: { value: TeamMemberRoleType; label: string; description: string }[] = [
  { value: "owner", label: "Primary owner", description: "Featured at the top; only one allowed" },
  { value: "co_owner", label: "Co-owner", description: "Shown alongside the primary owner" },
  { value: "team", label: "Team member", description: "Listed in the team section" }
];

const roleTypeBadgeClass: Record<TeamMemberRoleType, string> = {
  owner: "border-accent/35 bg-accent/10 text-accentSoft",
  co_owner: "border-info/35 bg-info/10 text-blue-300",
  team: "border-line bg-panelAlt text-muted"
};

const roleTypeLabel: Record<TeamMemberRoleType, string> = {
  owner: "Primary owner",
  co_owner: "Co-owner",
  team: "Team member"
};

const inputCls =
  "w-full rounded-xl border border-line bg-panelAlt/70 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/20";
const labelCls = "mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function TeamAvatar({ member }: { member: BusinessTeamMember }) {
  if (member.photoUrl) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-accent/35">
        <Image
          src={member.photoUrl}
          alt={member.name}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/10 font-display text-xl text-accentSoft">
      {getInitials(member.name) || "MB"}
    </div>
  );
}

export function BusinessTeamManager({
  businessId,
  showUidField = false
}: BusinessTeamManagerProps) {
  const { members, loading, error } = useBusinessTeam(businessId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BusinessTeamMember | null>(null);
  const [formValues, setFormValues] = useState<BusinessTeamMemberFormValues>(
    createTeamMemberDraft()
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const nextOrder = useMemo(
    () =>
      members.length
        ? Math.max(...members.map((m) => m.order)) + 1
        : 0,
    [members]
  );

  const hasOwner = members.some((m) => m.roleType === "owner");

  function openAddForm() {
    setEditingMember(null);
    setPhotoFile(null);
    const isFirst = members.length === 0;
    setFormValues({
      ...createTeamMemberDraft(nextOrder),
      roleType: isFirst ? "owner" : "team",
      isOwner: isFirst
    });
    setFormOpen(true);
  }

  function openEditForm(member: BusinessTeamMember) {
    setEditingMember(member);
    setPhotoFile(null);
    setFormValues(teamMemberToFormValues(member));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMember(null);
    setPhotoFile(null);
  }

  function updateField<Key extends keyof BusinessTeamMemberFormValues>(
    field: Key,
    value: BusinessTeamMemberFormValues[Key]
  ) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
      // Keep isOwner in sync with roleType for backward compat
      ...(field === "roleType"
        ? { isOwner: value === "owner" }
        : {})
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      let photoUrl = formValues.photoUrl;

      if (photoFile) {
        photoUrl = await uploadBusinessTeamPhoto(businessId, photoFile);
      }

      await saveBusinessTeamMember(businessId, editingMember?.id ?? null, {
        ...formValues,
        photoUrl
      });
      setFeedbackTone("success");
      setFeedback(editingMember ? "Team member updated." : "Team member added.");
      closeForm();
    } catch (saveError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(member: BusinessTeamMember) {
    if (!window.confirm(`Remove ${member.name} from this team?`)) return;

    setSaving(true);
    setFeedback(null);

    try {
      await deleteBusinessTeamMember(businessId, member);
      setFeedbackTone("success");
      setFeedback("Team member removed.");
    } catch (removeError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(removeError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }

    const sourceIndex = members.findIndex((m) => m.id === draggingId);
    const targetIndex = members.findIndex((m) => m.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggingId(null);
      return;
    }

    const nextMembers = [...members];
    const [sourceMember] = nextMembers.splice(sourceIndex, 1);
    nextMembers.splice(targetIndex, 0, sourceMember);
    setDraggingId(null);
    setSaving(true);
    setFeedback(null);

    try {
      await reorderBusinessTeamMembers(businessId, nextMembers);
      setFeedbackTone("success");
      setFeedback("Team order updated.");
    } catch (reorderError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(reorderError));
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoInput(event: ChangeEvent<HTMLInputElement>) {
    setPhotoFile(event.target.files?.[0] ?? null);
  }

  return (
    <div className="rounded-2xl border border-line bg-panel/85 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Team profiles
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
            Add the owner, co-owners, and staff shown on the public business profile.
            Drag cards to reorder within each role tier.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
        >
          Add profile
        </button>
      </div>

      {feedback ? (
        <div
          className={`mt-5 rounded-xl px-4 py-3 text-sm ${
            feedbackTone === "success"
              ? "border border-success/35 bg-success/10 text-stone-100"
              : "border border-danger/35 bg-danger/10 text-stone-100"
          }`}
        >
          {feedback}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 h-32 animate-pulse rounded-xl border border-line bg-panelAlt/70" />
      ) : error ? (
        <div className="mt-6 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
          {error}
        </div>
      ) : members.length ? (
        <div className="mt-6 space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              draggable
              onDragStart={() => setDraggingId(member.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void handleDrop(member.id)}
              className={`rounded-xl border p-4 transition ${
                draggingId === member.id
                  ? "border-accent bg-accent/10"
                  : "border-line bg-panelAlt/65"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <TeamAvatar member={member} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-100">
                        {member.title ? `${member.title} ` : ""}
                        {member.name}
                      </p>
                      {member.pronouns ? (
                        <span className="text-xs text-stone-500">
                          ({member.pronouns})
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${roleTypeBadgeClass[member.roleType]}`}
                      >
                        {roleTypeLabel[member.roleType]}
                      </span>
                      {!member.visible ? (
                        <span className="rounded-full border border-danger/35 bg-danger/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-200">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    {member.role ? (
                      <p className="mt-1 text-sm text-stone-400">{member.role}</p>
                    ) : null}
                    {member.bio ? (
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
                        {member.bio}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(member)}
                    className="rounded-full border border-line px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(member)}
                    disabled={saving}
                    className="rounded-full border border-danger/35 bg-danger/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-danger/15"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-canvas/40 p-8 text-center text-sm text-stone-400">
          No team profiles yet.
        </div>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <button
            type="button"
            aria-label="Close team form"
            className="absolute inset-0 cursor-default"
            onClick={closeForm}
          />
          <form
            onSubmit={handleSubmit}
            className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-canvas p-6 shadow-glow sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                  {editingMember ? "Edit profile" : "Add profile"}
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold text-ink">
                  Team profile
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-line px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35"
              >
                Close
              </button>
            </div>

            <div className="mt-8 space-y-5">

              {/* ── Role type ─────────────────────────────────────────── */}
              <div>
                <p className={labelCls}>Role type</p>
                <div className="grid gap-2">
                  {ROLE_TYPE_OPTIONS.map((option) => {
                    const isSelected = formValues.roleType === option.value;
                    const wouldConflict =
                      option.value === "owner" &&
                      hasOwner &&
                      editingMember?.roleType !== "owner";
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                          isSelected
                            ? "border-accent/50 bg-accent/10"
                            : "border-line bg-panelAlt/60 hover:border-accent/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="roleType"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => updateField("roleType", option.value)}
                          className="mt-0.5 accent-accent"
                        />
                        <div>
                          <p className="text-sm font-medium text-stone-100">
                            {option.label}
                            {wouldConflict ? (
                              <span className="ml-2 text-xs text-stone-500">
                                (current owner will become co-owner)
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-stone-500">
                            {option.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ── Identity ──────────────────────────────────────────── */}
              {showUidField ? (
                <div>
                  <label className={labelCls}>
                    Firebase UID
                    <input
                      value={formValues.uid}
                      onChange={(e) => updateField("uid", e.target.value)}
                      placeholder="Optional linked account UID"
                      className={`mt-2 ${inputCls}`}
                    />
                  </label>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className={labelCls}>
                    Name *
                    <input
                      value={formValues.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="Full name"
                      required
                      className={`mt-2 ${inputCls}`}
                    />
                  </label>
                </div>
                <div>
                  <label className={labelCls}>
                    Title / Honorific
                    <input
                      value={formValues.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="Dr., Rev."
                      className={`mt-2 ${inputCls} w-32`}
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    Role / Job title
                    <input
                      value={formValues.role}
                      onChange={(e) => updateField("role", e.target.value)}
                      placeholder="Chef, Operations Manager"
                      className={`mt-2 ${inputCls}`}
                    />
                  </label>
                </div>
                <div>
                  <label className={labelCls}>
                    Pronouns
                    <input
                      value={formValues.pronouns}
                      onChange={(e) => updateField("pronouns", e.target.value)}
                      placeholder="she/her, they/them"
                      className={`mt-2 ${inputCls}`}
                    />
                  </label>
                </div>
              </div>

              {/* ── Bio & photo ───────────────────────────────────────── */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className={labelCls.replace("mb-2 ", "")}>Bio</p>
                  <span className="text-xs text-stone-500">
                    {formValues.bio.length}/400
                  </span>
                </div>
                <textarea
                  value={formValues.bio}
                  maxLength={400}
                  rows={3}
                  onChange={(e) =>
                    updateField("bio", e.target.value.slice(0, 400))
                  }
                  placeholder="Two or three sentences about this person."
                  className={inputCls}
                />
              </div>

              <div>
                <p className={labelCls}>Photo</p>
                {formValues.photoUrl ? (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-panelAlt/70 p-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-full">
                      <Image
                        src={formValues.photoUrl}
                        alt={formValues.name || "Team member"}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField("photoUrl", "")}
                      className="rounded-full border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-rose-200"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : null}
                <input type="file" accept="image/*" onChange={handlePhotoInput} />
                {photoFile ? (
                  <p className="mt-2 text-xs text-stone-400">
                    Selected: {photoFile.name}
                  </p>
                ) : null}
              </div>

              {/* ── Social links ──────────────────────────────────────── */}
              <div>
                <p className={labelCls}>Social links</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      LinkedIn
                    </label>
                    <input
                      value={formValues.linkedinUrl}
                      onChange={(e) => updateField("linkedinUrl", e.target.value)}
                      placeholder="https://linkedin.com/in/…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      Instagram
                    </label>
                    <input
                      value={formValues.instagramUrl}
                      onChange={(e) => updateField("instagramUrl", e.target.value)}
                      placeholder="https://instagram.com/…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      Facebook
                    </label>
                    <input
                      value={formValues.facebookUrl}
                      onChange={(e) => updateField("facebookUrl", e.target.value)}
                      placeholder="https://facebook.com/…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      TikTok
                    </label>
                    <input
                      value={formValues.tiktokUrl}
                      onChange={(e) => updateField("tiktokUrl", e.target.value)}
                      placeholder="https://tiktok.com/@…"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* ── Contact ───────────────────────────────────────────── */}
              <div>
                <p className={labelCls}>Contact info</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formValues.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="name@example.com"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formValues.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="(414) 555-0100"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                      Personal/business website
                    </label>
                    <input
                      type="url"
                      value={formValues.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      placeholder="https://mysite.com"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* ── Settings ──────────────────────────────────────────── */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panelAlt/70 p-4 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={formValues.visible}
                    onChange={(e) => updateField("visible", e.target.checked)}
                    className="accent-accent"
                  />
                  Visible on profile
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-panelAlt/70 p-4 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={formValues.displayContact}
                    onChange={(e) =>
                      updateField("displayContact", e.target.checked)
                    }
                    className="accent-accent"
                  />
                  Show contact info publicly
                </label>
              </div>
            </div>

            {feedback ? (
              <p
                className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                  feedbackTone === "success"
                    ? "border-success/35 bg-success/10 text-stone-100"
                    : "border-danger/35 bg-danger/10 text-stone-100"
                }`}
              >
                {feedback}
              </p>
            ) : null}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
