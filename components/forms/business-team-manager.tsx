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
  BusinessTeamMemberFormValues
} from "@/lib/types";

type BusinessTeamManagerProps = {
  businessId: string;
  showUidField?: boolean;
};

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
  const [editingMember, setEditingMember] = useState<BusinessTeamMember | null>(
    null
  );
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
        ? Math.max(...members.map((member) => member.order)) + 1
        : 0,
    [members]
  );

  function openAddForm() {
    setEditingMember(null);
    setPhotoFile(null);
    setFormValues({
      ...createTeamMemberDraft(nextOrder),
      role: members.length ? "" : "Owner",
      isOwner: members.length === 0
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
      [field]: value
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

      await saveBusinessTeamMember(
        businessId,
        editingMember?.id ?? null,
        {
          ...formValues,
          photoUrl
        }
      );
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
    const confirmed = window.confirm(`Remove ${member.name} from this team?`);

    if (!confirmed) {
      return;
    }

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

    const sourceIndex = members.findIndex((member) => member.id === draggingId);
    const targetIndex = members.findIndex((member) => member.id === targetId);

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
    const file = event.target.files?.[0] ?? null;
    setPhotoFile(file);
  }

  return (
    <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Team profiles
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
            Add the owner and staff members shown on the public business profile.
            Drag cards to reorder them.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
        >
          Add team member
        </button>
      </div>

      {feedback ? (
        <div
          className={`mt-5 rounded-3xl px-4 py-3 text-sm ${
            feedbackTone === "success"
              ? "border border-success/35 bg-success/10 text-stone-100"
              : "border border-danger/35 bg-danger/10 text-stone-100"
          }`}
        >
          {feedback}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 h-32 animate-pulse rounded-3xl border border-line bg-panelAlt/70" />
      ) : error ? (
        <div className="mt-6 rounded-3xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
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
              className={`rounded-3xl border p-4 transition ${
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
                      <p className="font-medium text-stone-100">{member.name}</p>
                      {member.isOwner ? (
                        <span className="rounded-full border border-accent/35 bg-accent/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-accentSoft">
                          Primary owner
                        </span>
                      ) : null}
                      {!member.visible ? (
                        <span className="rounded-full border border-danger/35 bg-danger/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-200">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-400">{member.role}</p>
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
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-canvas/40 p-8 text-center text-sm text-stone-400">
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
                  {editingMember ? "Edit member" : "Add member"}
                </p>
                <h2 className="mt-3 font-display text-4xl text-ink">
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

            <div className="mt-8 grid gap-5">
              {showUidField ? (
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Firebase UID
                  </label>
                  <input
                    value={formValues.uid}
                    onChange={(event) => updateField("uid", event.target.value)}
                    placeholder="Optional account UID"
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Name
                </label>
                <input
                  value={formValues.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Team member name"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Role
                </label>
                <input
                  value={formValues.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  placeholder="Owner, Manager, Chef"
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-xs uppercase tracking-[0.2em] text-muted">
                    Bio
                  </label>
                  <span className="text-xs text-stone-500">
                    {formValues.bio.length}/300
                  </span>
                </div>
                <textarea
                  value={formValues.bio}
                  maxLength={300}
                  onChange={(event) =>
                    updateField("bio", event.target.value.slice(0, 300))
                  }
                  placeholder="Two or three sentences about this person."
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Photo
                </label>
                {formValues.photoUrl ? (
                  <div className="mb-3 flex items-center gap-3 rounded-3xl border border-line bg-panelAlt/70 p-3">
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
                  <p className="mt-2 text-sm text-stone-400">
                    Selected: {photoFile.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  LinkedIn URL
                </label>
                <input
                  value={formValues.linkedinUrl}
                  onChange={(event) =>
                    updateField("linkedinUrl", event.target.value)
                  }
                  placeholder="https://www.linkedin.com/in/..."
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Instagram URL
                </label>
                <input
                  value={formValues.instagramUrl}
                  onChange={(event) =>
                    updateField("instagramUrl", event.target.value)
                  }
                  placeholder="https://www.instagram.com/..."
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-3xl border border-line bg-panelAlt/70 p-4 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={formValues.visible}
                    onChange={(event) =>
                      updateField("visible", event.target.checked)
                    }
                  />
                  Visible on profile
                </label>
                <label className="flex items-center gap-3 rounded-3xl border border-line bg-panelAlt/70 p-4 text-sm text-stone-200">
                  <input
                    type="checkbox"
                    checked={formValues.isOwner}
                    onChange={(event) =>
                      updateField("isOwner", event.target.checked)
                    }
                  />
                  Mark as primary owner
                </label>
              </div>
            </div>

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
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
              >
                {saving ? "Saving..." : "Save member"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
