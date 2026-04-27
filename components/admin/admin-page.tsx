"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BusinessEditorForm } from "@/components/forms/business-editor-form";
import { StatePanel } from "@/components/ui/state-panel";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import { businessToFormValues } from "@/lib/businesses";
import {
  createBusiness,
  createBusinessDraft,
  removeBusinessPhoto,
  saveBusiness,
  uploadBusinessPhotos
} from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessFormValues } from "@/lib/types";

type AdminPageContentProps = {
  initialMode?: string | string[];
};

function isCreateMode(mode: string | string[] | undefined) {
  return Array.isArray(mode) ? mode.includes("create") : mode === "create";
}

export function AdminPageContent({ initialMode }: AdminPageContentProps) {
  const { businesses, loading, error } = useAllBusinesses();
  const startCreating = isCreateMode(initialMode);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [creating, setCreating] = useState(startCreating);
  const [draftValues, setDraftValues] = useState(createBusinessDraft());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!startCreating) {
      return;
    }

    setCreating(true);
    setSelectedBusinessId(null);
    setDraftValues(createBusinessDraft());
  }, [startCreating]);

  useEffect(() => {
    if (!loading && businesses.length && !selectedBusinessId && !creating) {
      setSelectedBusinessId(businesses[0].id);
    }
  }, [businesses, creating, loading, selectedBusinessId]);

  const filteredBusinesses = businesses.filter((business) =>
    [business.name, business.category, business.address]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const selectedBusiness =
    businesses.find((business) => business.id === selectedBusinessId) ?? null;

  async function handleUpdate(values: BusinessFormValues) {
    if (!selectedBusiness) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await saveBusiness(selectedBusiness.id, values, selectedBusiness.address);
      setFeedbackTone("success");
      setFeedback("Listing saved.");
    } catch (saveError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(values: BusinessFormValues) {
    setSaving(true);
    setFeedback(null);

    try {
      const nextId = await createBusiness(values);
      setSelectedBusinessId(nextId);
      setCreating(false);
      setDraftValues(createBusinessDraft());
      setFeedbackTone("success");
      setFeedback("New listing created.");
    } catch (createError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: File[]) {
    if (!selectedBusiness) {
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      await uploadBusinessPhotos(selectedBusiness.id, files);
      setFeedbackTone("success");
      setFeedback("Photos uploaded.");
    } catch (uploadError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(photoUrl: string) {
    if (!selectedBusiness) {
      return;
    }

    setFeedback(null);

    try {
      await removeBusinessPhoto(selectedBusiness.id, photoUrl);
      setFeedbackTone("success");
      setFeedback("Photo removed.");
    } catch (removeError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(removeError));
    }
  }

  const activeCount = businesses.filter((business) => business.active).length;

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.6rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Admin workspace
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Review every listing.
              </h1>
              <div className="mt-6">
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/businesses"
                    className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
                  >
                    Open business manager
                  </Link>
                  <Link
                    href="/admin/import"
                    className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
                  >
                    Import spreadsheet
                  </Link>
                  <Link
                    href="/admin/homepage"
                    className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
                  >
                    Open homepage workspace
                  </Link>
                  <Link
                    href="/admin/tags"
                    className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
                  >
                    Manage tags
                  </Link>
                  <Link
                    href="/admin/hours-sync"
                    className="inline-flex rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
                  >
                    Sync hours
                  </Link>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Total listings
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {loading ? "--" : businesses.length}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Active listings
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {loading ? "--" : activeCount}
              </p>
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

        <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                Listings
              </p>
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setSelectedBusinessId(null);
                  setDraftValues(createBusinessDraft());
                }}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:bg-accentSoft"
              >
                New listing
              </button>
            </div>

            <div className="mt-4">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search listings"
              />
            </div>

            {loading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-3xl border border-line bg-panelAlt/70"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="mt-4">
                <StatePanel title="Unable to load listings" description={error} />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {filteredBusinesses.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelectedBusinessId(business.id);
                    }}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      selectedBusinessId === business.id && !creating
                        ? "border-accent/50 bg-accent/10"
                        : "border-line bg-panelAlt/65 hover:border-accent/35"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-stone-100">{business.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
                          {business.category}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                          business.active
                            ? "border border-success/35 bg-success/10 text-success"
                            : "border border-danger/35 bg-danger/10 text-rose-200"
                        }`}
                      >
                        {business.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-400">
                      {business.address}
                    </p>
                  </button>
                ))}

                {!filteredBusinesses.length ? (
                  <div className="rounded-3xl border border-dashed border-line bg-canvas/40 p-6 text-center text-sm text-stone-400">
                    No listings match that search.
                  </div>
                ) : null}
              </div>
            )}
          </aside>

          <div>
            {creating ? (
              <BusinessEditorForm
                initialValues={draftValues}
                title="Create listing"
                description="Add a business manually, then assign an owner UID if one already exists in Firebase Auth."
                submitLabel="Create listing"
                onSubmit={handleCreate}
                saving={saving}
                showAdminFields
              />
            ) : selectedBusiness ? (
              <BusinessEditorForm
                initialValues={businessToFormValues(selectedBusiness)}
                title="Edit listing"
                description="Admins can edit any listing, deactivate it, or attach it to an owner account."
                submitLabel="Save listing"
                onSubmit={handleUpdate}
                onUploadPhotos={handleUpload}
                onRemovePhoto={handleRemove}
                saving={saving}
                uploading={uploading}
                showAdminFields
              />
            ) : (
              <StatePanel
                title="Select a listing"
                description="Choose a business from the left or create a new one to start editing."
              />
            )}
          </div>
        </div>
      </section>
    </ProtectedRoute>
  );
}
