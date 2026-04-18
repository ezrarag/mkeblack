"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StatePanel } from "@/components/ui/state-panel";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import {
  getBusinessSourceBadgeClass,
  getBusinessSourceLabel,
  businessToFormValues
} from "@/lib/businesses";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import {
  deleteBusinesses,
  saveBusiness,
  setBusinessesActive
} from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";

type DraftMap = Record<string, ReturnType<typeof businessToFormValues>>;

export function BusinessManagementPage() {
  const { businesses, loading, error } = useAllBusinesses();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      const matchesSearch =
        !searchTerm.trim() ||
        [
          business.name,
          business.category,
          business.address,
          business.phone,
          business.website,
          business.hoursText
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || business.category === selectedCategory;
      const matchesSource =
        selectedSource === "all" || business.source === selectedSource;
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" ? business.active : !business.active);

      return matchesSearch && matchesCategory && matchesSource && matchesStatus;
    });
  }, [businesses, searchTerm, selectedCategory, selectedSource, selectedStatus]);

  const categoryOptions = Array.from(
    new Set([...BUSINESS_CATEGORIES, ...businesses.map((business) => business.category)])
  );

  const allVisibleIds = filteredBusinesses.map((business) => business.id);
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));

  function getDraft(businessId: string) {
    const existingDraft = drafts[businessId];

    if (existingDraft) {
      return existingDraft;
    }

    const business = businesses.find((item) => item.id === businessId);
    return business ? businessToFormValues(business) : null;
  }

  function updateDraft(
    businessId: string,
    updater: (current: NonNullable<ReturnType<typeof getDraft>>) => ReturnType<typeof businessToFormValues>
  ) {
    const currentDraft = getDraft(businessId);

    if (!currentDraft) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [businessId]: updater(currentDraft)
    }));
  }

  async function handleSaveRow(businessId: string) {
    const business = businesses.find((item) => item.id === businessId);
    const draft = getDraft(businessId);

    if (!business || !draft) {
      return;
    }

    setSavingId(businessId);
    setFeedback(null);

    try {
      await saveBusiness(businessId, draft, business.address);
      setFeedbackTone("success");
      setFeedback(`Saved ${business.name}.`);
      setDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[businessId];
        return nextDrafts;
      });
    } catch (saveError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(saveError));
    } finally {
      setSavingId(null);
    }
  }

  async function handleBulkActive(active: boolean) {
    if (!filteredBusinesses.length) {
      return;
    }

    setBulkSaving(true);
    setFeedback(null);

    try {
      await setBusinessesActive(
        filteredBusinesses.map((business) => business.id),
        active
      );
      setFeedbackTone("success");
      setFeedback(
        `${active ? "Activated" : "Deactivated"} ${filteredBusinesses.length} visible listings.`
      );
    } catch (bulkError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(bulkError));
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleDeleteSelected() {
    const nextBusinesses = businesses.filter((business) =>
      selectedIds.includes(business.id)
    );

    if (!nextBusinesses.length) {
      return;
    }

    setBulkSaving(true);
    setFeedback(null);

    try {
      await deleteBusinesses(
        nextBusinesses.map((business) => ({
          id: business.id,
          photos: business.photos
        }))
      );
      setSelectedIds([]);
      setFeedbackTone("success");
      setFeedback(`Deleted ${nextBusinesses.length} selected listings.`);
    } catch (deleteError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(deleteError));
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.6rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Business manager
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Manage imported and manual listings.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                Search, filter, edit inline, then open the full edit route when a
                listing needs photos, map overrides, or owner-claim setup.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/import"
                className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
              >
                Import spreadsheet
              </Link>
              <Link
                href="/admin"
                className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
              >
                Back to admin
              </Link>
            </div>
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

        <div className="mt-6 rounded-[2.2rem] border border-line bg-panel/85 p-5">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Search
              </label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, category, address, or hours"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Source
              </label>
              <select
                value={selectedSource}
                onChange={(event) => setSelectedSource(event.target.value)}
              >
                <option value="all">All sources</option>
                <option value="import">Import</option>
                <option value="manual">Manual</option>
                <option value="self-submitted">Self-submitted</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleBulkActive(true)}
              disabled={bulkSaving || !filteredBusinesses.length}
              className="rounded-full border border-success/35 bg-success/10 px-4 py-2 text-sm text-success transition hover:bg-success/15"
            >
              Activate all
            </button>
            <button
              type="button"
              onClick={() => void handleBulkActive(false)}
              disabled={bulkSaving || !filteredBusinesses.length}
              className="rounded-full border border-danger/35 bg-danger/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-danger/15"
            >
              Deactivate all
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={bulkSaving || !selectedIds.length}
              className="rounded-full border border-danger/35 bg-danger/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-danger/15"
            >
              Delete selected
            </button>
            <p className="self-center text-sm text-stone-400">
              Bulk actions apply to the current filtered table.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-[2rem] border border-line bg-panel/70"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6">
            <StatePanel title="Unable to load businesses" description={error} />
          </div>
        ) : filteredBusinesses.length ? (
          <div className="mt-6 overflow-hidden rounded-[2.2rem] border border-line bg-panel/85">
            <div className="overflow-x-auto">
              <table className="min-w-[1400px] divide-y divide-line text-left text-sm">
                <thead className="bg-panelAlt/80">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(event) =>
                          setSelectedIds(
                            event.target.checked
                              ? allVisibleIds
                              : selectedIds.filter((id) => !allVisibleIds.includes(id))
                          )
                        }
                      />
                    </th>
                    <th className="px-4 py-3 font-medium text-stone-100">Name</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Category</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Hours</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Address</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Phone</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Website</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Source</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Active</th>
                    <th className="px-4 py-3 font-medium text-stone-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/70">
                  {filteredBusinesses.map((business) => {
                    const draft = getDraft(business.id);

                    if (!draft) {
                      return null;
                    }

                    const categoryChoices = Array.from(
                      new Set([...BUSINESS_CATEGORIES, draft.category].filter(Boolean))
                    );

                    return (
                      <tr key={business.id}>
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(business.id)}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked
                                  ? [...current, business.id]
                                  : current.filter((id) => id !== business.id)
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            value={draft.name}
                            onChange={(event) =>
                              updateDraft(business.id, (current) => ({
                                ...current,
                                name: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <select
                            value={draft.category}
                            onChange={(event) =>
                              updateDraft(business.id, (current) => ({
                                ...current,
                                category: event.target.value
                              }))
                            }
                          >
                            {categoryChoices.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            value={draft.hoursText}
                            onChange={(event) =>
                              updateDraft(business.id, (current) => ({
                                ...current,
                                hoursText: event.target.value
                              }))
                            }
                            placeholder="Hours text"
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            value={draft.address}
                            onChange={(event) =>
                              updateDraft(business.id, (current) => ({
                                ...current,
                                address: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            value={draft.phone}
                            onChange={(event) =>
                              updateDraft(business.id, (current) => ({
                                ...current,
                                phone: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            value={draft.website}
                            onChange={(event) =>
                              updateDraft(business.id, (current) => ({
                                ...current,
                                website: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${getBusinessSourceBadgeClass(
                              business.source
                            )}`}
                          >
                            {getBusinessSourceLabel(business.source)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <label className="flex items-center gap-3 text-sm text-stone-200">
                            <input
                              type="checkbox"
                              checked={draft.active}
                              onChange={(event) =>
                                updateDraft(business.id, (current) => ({
                                  ...current,
                                  active: event.target.checked
                                }))
                              }
                            />
                            {draft.active ? "Active" : "Inactive"}
                          </label>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveRow(business.id)}
                              disabled={savingId === business.id}
                              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:bg-accentSoft"
                            >
                              {savingId === business.id ? "Saving..." : "Save"}
                            </button>
                            <Link
                              href={`/admin/businesses/${business.id}`}
                              className="rounded-full border border-line px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
                            >
                              Full edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <StatePanel
              title="No businesses match these filters"
              description="Try broadening the filters or import a spreadsheet to add more listings."
            />
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
