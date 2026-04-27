"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useBusinessTags } from "@/hooks/use-business-tags";
import {
  addBusinessTag,
  deactivateBusinessTag,
  mergeBusinessTags,
  updateBusinessTag
} from "@/lib/firebase/tags";
import { formatFirebaseError } from "@/lib/firebase-errors";
import {
  BUSINESS_TAG_CATEGORIES,
  createBusinessTagId
} from "@/lib/tags";
import { BusinessTag, BusinessTagCategory } from "@/lib/types";

type DraftTag = {
  label: string;
  category: BusinessTagCategory;
  adminOnly: boolean;
};

function getDraftValue(tag: BusinessTag, drafts: Record<string, DraftTag>) {
  return (
    drafts[tag.id] ?? {
      label: tag.label,
      category: tag.category,
      adminOnly: tag.adminOnly
    }
  );
}

function TagManagementContent() {
  const { tags, loading, error } = useBusinessTags();
  const [drafts, setDrafts] = useState<Record<string, DraftTag>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newCategory, setNewCategory] =
    useState<BusinessTagCategory>("Identity");
  const [newAdminOnly, setNewAdminOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTagId, setBusyTagId] = useState<string | null>(null);
  const [sourceTagId, setSourceTagId] = useState("");
  const [targetTagId, setTargetTagId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const sortedTags = useMemo(
    () =>
      [...tags].sort((left, right) => {
        const categoryCompare = left.category.localeCompare(right.category);
        return categoryCompare || left.label.localeCompare(right.label);
      }),
    [tags]
  );
  const activeTags = sortedTags.filter((tag) => tag.active);
  const computedNewSlug = newSlug || createBusinessTagId(newLabel);

  function updateDraft(tag: BusinessTag, values: Partial<DraftTag>) {
    setDrafts((current) => ({
      ...current,
      [tag.id]: {
        ...getDraftValue(tag, current),
        ...values
      }
    }));
  }

  async function handleAddTag() {
    setSaving(true);
    setFeedback(null);

    try {
      await addBusinessTag({
        label: newLabel,
        slug: computedNewSlug,
        category: newCategory,
        adminOnly: newAdminOnly
      });
      setNewLabel("");
      setNewSlug("");
      setNewCategory("Identity");
      setNewAdminOnly(false);
      setFeedbackTone("success");
      setFeedback("Tag added.");
    } catch (addError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(addError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTag(tag: BusinessTag) {
    const draft = getDraftValue(tag, drafts);
    setBusyTagId(tag.id);
    setFeedback(null);

    try {
      await updateBusinessTag(tag.id, {
        ...draft,
        active: tag.active
      });
      setDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[tag.id];
        return nextDrafts;
      });
      setFeedbackTone("success");
      setFeedback(`Saved ${draft.label}.`);
    } catch (saveError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(saveError));
    } finally {
      setBusyTagId(null);
    }
  }

  async function handleActiveToggle(tag: BusinessTag, active: boolean) {
    if (!active) {
      const confirmed = window.confirm(
        `Deactivate "${tag.label}" and remove it from all business listings?`
      );

      if (!confirmed) {
        return;
      }
    }

    setBusyTagId(tag.id);
    setFeedback(null);

    try {
      if (active) {
        const draft = getDraftValue(tag, drafts);
        await updateBusinessTag(tag.id, {
          ...draft,
          active: true
        });
      } else {
        await deactivateBusinessTag(tag);
      }
      setFeedbackTone("success");
      setFeedback(active ? "Tag activated." : "Tag deactivated and removed.");
    } catch (toggleError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(toggleError));
    } finally {
      setBusyTagId(null);
    }
  }

  async function handleMergeTags() {
    const source = tags.find((tag) => tag.id === sourceTagId);
    const target = tags.find((tag) => tag.id === targetTagId);

    if (!source || !target) {
      setFeedbackTone("error");
      setFeedback("Choose a source tag and a target tag.");
      return;
    }

    const confirmed = window.confirm(
      `Merge "${source.label}" into "${target.label}"? The source tag will be deleted.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await mergeBusinessTags(source, target);
      setSourceTagId("");
      setTargetTagId("");
      setFeedbackTone("success");
      setFeedback(`Merged ${source.label} into ${target.label}.`);
    } catch (mergeError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(mergeError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.6rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Tag manager
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Manage directory filters.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                Tags appear as public filters, profile badges, and owner-selectable
                listing attributes unless marked admin-only.
              </p>
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
            >
              Back to admin
            </Link>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-6 rounded-3xl px-5 py-4 text-sm ${
              feedbackTone === "success"
                ? "border border-success/35 bg-success/10 text-stone-100"
                : "border border-danger/35 bg-danger/10 text-stone-100"
            }`}
          >
            {feedback}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Add tag
            </p>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Label
                </label>
                <input
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder="Vegan Options"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Slug
                </label>
                <input
                  value={computedNewSlug}
                  onChange={(event) => setNewSlug(createBusinessTagId(event.target.value))}
                  placeholder="vegan-options"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value as BusinessTagCategory)
                  }
                >
                  {BUSINESS_TAG_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-3xl border border-line bg-panelAlt/70 p-4 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={newAdminOnly}
                  onChange={(event) => setNewAdminOnly(event.target.checked)}
                />
                Admin-only tag
              </label>
              <button
                type="button"
                onClick={() => void handleAddTag()}
                disabled={saving || !newLabel.trim()}
                className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
              >
                Add tag
              </button>
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Merge tags
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Source
                </label>
                <select
                  value={sourceTagId}
                  onChange={(event) => setSourceTagId(event.target.value)}
                >
                  <option value="">Choose source</option>
                  {sortedTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Target
                </label>
                <select
                  value={targetTagId}
                  onChange={(event) => setTargetTagId(event.target.value)}
                >
                  <option value="">Choose target</option>
                  {activeTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleMergeTags()}
                  disabled={saving || !sourceTagId || !targetTagId}
                  className="w-full rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm text-accentSoft transition hover:bg-accent/15"
                >
                  Merge
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 h-48 animate-pulse rounded-[2.2rem] border border-line bg-panel/70" />
        ) : error ? (
          <div className="mt-6">
            <StatePanel title="Unable to load tags" description={error} />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[2.2rem] border border-line bg-panel/85">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] divide-y divide-line text-left text-sm">
                <thead className="bg-panelAlt/80">
                  <tr>
                    <th className="px-4 py-3 font-medium text-stone-100">Label</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Slug</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Category</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Usage</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Active</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Admin only</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/70">
                  {sortedTags.map((tag) => {
                    const draft = getDraftValue(tag, drafts);

                    return (
                      <tr key={tag.id}>
                        <td className="px-4 py-4 align-top">
                          <input
                            value={draft.label}
                            onChange={(event) =>
                              updateDraft(tag, { label: event.target.value })
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <code className="rounded-full border border-line bg-canvas/50 px-3 py-2 text-xs text-stone-300">
                            {tag.slug}
                          </code>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <select
                            value={draft.category}
                            onChange={(event) =>
                              updateDraft(tag, {
                                category: event.target.value as BusinessTagCategory
                              })
                            }
                          >
                            {BUSINESS_TAG_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 align-top text-stone-200">
                          {tag.usageCount}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={tag.active}
                            onChange={(event) =>
                              void handleActiveToggle(tag, event.target.checked)
                            }
                            disabled={busyTagId === tag.id}
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={draft.adminOnly}
                            onChange={(event) =>
                              updateDraft(tag, { adminOnly: event.target.checked })
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <button
                            type="button"
                            onClick={() => void handleSaveTag(tag)}
                            disabled={busyTagId === tag.id}
                            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:bg-accentSoft"
                          >
                            {busyTagId === tag.id ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </section>
  );
}

export function TagManagementPage() {
  return (
    <ProtectedRoute requireAdmin>
      <TagManagementContent />
    </ProtectedRoute>
  );
}
