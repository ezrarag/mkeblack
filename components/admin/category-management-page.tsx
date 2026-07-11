"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useBusinessCategories } from "@/hooks/use-business-categories";
import {
  addBusinessCategory,
  deactivateBusinessCategory,
  mergeBusinessCategories,
  updateBusinessCategory
} from "@/lib/firebase/categories";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { createBusinessCategoryId } from "@/lib/categories";
import { BusinessCategoryOption } from "@/lib/types";
import { getFirebaseDb, loadFirebaseFirestoreModule } from "@/lib/firebase/client";
import { normalizeCategoryValue } from "@/lib/businesses";

type DraftCategory = {
  label: string;
};

function getDraftValue(
  category: BusinessCategoryOption,
  drafts: Record<string, DraftCategory>
) {
  return (
    drafts[category.id] ?? {
      label: category.label
    }
  );
}

function CategoryManagementContent() {
  const { categories, loading, error } = useBusinessCategories();
  const [drafts, setDrafts] = useState<Record<string, DraftCategory>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [sourceCategoryId, setSourceCategoryId] = useState("");
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [orphanedCategories, setOrphanedCategories] = useState<Array<{ label: string; usageCount: number }>>([]);
  const [auditing, setAuditing] = useState(true);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.label.localeCompare(right.label)),
    [categories]
  );
  const activeCategories = sortedCategories.filter((category) => category.active);
  const computedNewSlug = newSlug || createBusinessCategoryId(newLabel);

  useEffect(() => {
    let cancelled = false;
    async function audit() {
      try {
        const [firestoreModule, db] = await Promise.all([loadFirebaseFirestoreModule(), getFirebaseDb()]);
        if (!db) return;
        const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, "businesses"));
        const knownLabels = new Set(categories.map((category) => category.label.trim()));
        const usage = new Map<string, number>();
        snapshot.docs.forEach((document) => {
          const value = document.data().category;
          const label = typeof value === "string" ? normalizeCategoryValue(value) : "";
          if (label && !knownLabels.has(label)) usage.set(label, (usage.get(label) ?? 0) + 1);
        });
        if (!cancelled) setOrphanedCategories([...usage].map(([label, usageCount]) => ({ label, usageCount })).sort((a, b) => a.label.localeCompare(b.label)));
      } catch (auditError) {
        if (!cancelled) {
          setFeedbackTone("error");
          setFeedback(`Category audit failed: ${formatFirebaseError(auditError)}`);
        }
      } finally {
        if (!cancelled) setAuditing(false);
      }
    }
    if (!loading) void audit();
    return () => { cancelled = true; };
  }, [categories, loading]);

  async function handleAddOrphanedCategories() {
    setSaving(true);
    setFeedback(null);
    try {
      for (const category of orphanedCategories) await addBusinessCategory({ label: category.label });
      setFeedbackTone("success");
      setFeedback(`Added ${orphanedCategories.length} missing categor${orphanedCategories.length === 1 ? "y" : "ies"} to the manager.`);
    } catch (addError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(addError));
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(
    category: BusinessCategoryOption,
    values: Partial<DraftCategory>
  ) {
    setDrafts((current) => ({
      ...current,
      [category.id]: {
        ...getDraftValue(category, current),
        ...values
      }
    }));
  }

  async function handleAddCategory() {
    setSaving(true);
    setFeedback(null);

    try {
      await addBusinessCategory({
        label: newLabel,
        slug: computedNewSlug
      });
      setNewLabel("");
      setNewSlug("");
      setFeedbackTone("success");
      setFeedback("Category added.");
    } catch (addError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(addError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCategory(category: BusinessCategoryOption) {
    const draft = getDraftValue(category, drafts);
    setBusyCategoryId(category.id);
    setFeedback(null);

    try {
      await updateBusinessCategory(category.id, {
        ...draft,
        active: category.active
      });
      setDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[category.id];
        return nextDrafts;
      });
      setFeedbackTone("success");
      setFeedback(`Saved ${draft.label}.`);
    } catch (saveError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(saveError));
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function handleActiveToggle(
    category: BusinessCategoryOption,
    active: boolean
  ) {
    setBusyCategoryId(category.id);
    setFeedback(null);

    try {
      if (active) {
        const draft = getDraftValue(category, drafts);
        await updateBusinessCategory(category.id, {
          ...draft,
          active: true
        });
      } else {
        const confirmed = window.confirm(
          `Deactivate "${category.label}"? Categories with active usage must be merged first.`
        );

        if (!confirmed) {
          return;
        }

        await deactivateBusinessCategory(category);
      }
      setFeedbackTone("success");
      setFeedback(active ? "Category activated." : "Category deactivated.");
    } catch (toggleError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(toggleError));
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function handleMergeCategories() {
    const source = categories.find((category) => category.id === sourceCategoryId);
    const target = categories.find((category) => category.id === targetCategoryId);

    if (!source || !target) {
      setFeedbackTone("error");
      setFeedback("Choose a source category and a target category.");
      return;
    }

    const confirmed = window.confirm(
      `Merge "${source.label}" into "${target.label}"? Listings using the source will move to the target.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await mergeBusinessCategories(source, target);
      setSourceCategoryId("");
      setTargetCategoryId("");
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
      <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
              Category manager
            </p>
            <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink sm:text-6xl">
              Manage business categories.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
              Categories power directory filters and listing forms. Merge old
              categories into preferred labels before deactivating them.
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

      {!auditing && orphanedCategories.length ? (
        <div className="mt-6 rounded-2xl border border-amber-400/35 bg-amber-400/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-stone-100">Categories used by businesses but missing from the manager</p>
              <p className="mt-2 text-sm text-stone-300">{orphanedCategories.map((category) => `${category.label} (${category.usageCount})`).join(", ")}</p>
            </div>
            <button type="button" onClick={() => void handleAddOrphanedCategories()} disabled={saving} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              Add all to manager
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-line bg-panel/85 p-5">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Add category
          </p>
          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Label
              </label>
              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Food & Drink"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Slug
              </label>
              <input
                value={computedNewSlug}
                onChange={(event) =>
                  setNewSlug(createBusinessCategoryId(event.target.value))
                }
                placeholder="food-and-drink"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleAddCategory()}
              disabled={saving || !newLabel.trim()}
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-50"
            >
              Add category
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-panel/85 p-5">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Merge categories
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Source
              </label>
              <select
                value={sourceCategoryId}
                onChange={(event) => setSourceCategoryId(event.target.value)}
              >
                <option value="">Choose source</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Target
              </label>
              <select
                value={targetCategoryId}
                onChange={(event) => setTargetCategoryId(event.target.value)}
              >
                <option value="">Choose target</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void handleMergeCategories()}
                disabled={saving || !sourceCategoryId || !targetCategoryId}
                className="w-full rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm text-accentSoft transition hover:bg-accent/15 disabled:opacity-50"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-2xl border border-line bg-panel/70" />
      ) : error ? (
        <div className="mt-6">
          <StatePanel title="Unable to load categories" description={error} />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel/85">
          <div className="overflow-x-auto">
            <table className="min-w-[800px] divide-y divide-line text-left text-sm">
              <thead className="bg-panelAlt/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-stone-100">Label</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Slug</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Usage</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Active</th>
                  <th className="px-4 py-3 font-medium text-stone-100">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel/70">
                {sortedCategories.map((category) => {
                  const draft = getDraftValue(category, drafts);

                  return (
                    <tr key={category.id}>
                      <td className="px-4 py-4 align-top">
                        <input
                          value={draft.label}
                          onChange={(event) =>
                            updateDraft(category, { label: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <code className="rounded-full border border-line bg-canvas/50 px-3 py-2 text-xs text-stone-300">
                          {category.slug}
                        </code>
                      </td>
                      <td className="px-4 py-4 align-top text-stone-200">
                        {category.usageCount}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={category.active}
                          onChange={(event) =>
                            void handleActiveToggle(category, event.target.checked)
                          }
                          disabled={busyCategoryId === category.id}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => void handleSaveCategory(category)}
                          disabled={busyCategoryId === category.id}
                          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
                        >
                          {busyCategoryId === category.id ? "Saving..." : "Save"}
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

export function CategoryManagementPage() {
  return (
    <ProtectedRoute requireAdmin>
      <CategoryManagementContent />
    </ProtectedRoute>
  );
}
