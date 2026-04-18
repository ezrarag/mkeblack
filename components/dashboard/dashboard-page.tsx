"use client";

import { useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { BusinessEditorForm } from "@/components/forms/business-editor-form";
import { StatePanel } from "@/components/ui/state-panel";
import { useBusiness } from "@/hooks/use-business";
import {
  removeBusinessPhoto,
  saveBusiness,
  uploadBusinessPhotos
} from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessFormValues } from "@/lib/types";

export function DashboardPageContent() {
  const { profile, isAdmin } = useAuth();
  const { business, loading, error } = useBusiness(profile?.businessId ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  async function handleSave(values: BusinessFormValues) {
    if (!business) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      await saveBusiness(business.id, values, business.address);
      setFeedbackTone("success");
      setFeedback("Listing updated successfully.");
    } catch (saveError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: File[]) {
    if (!business) {
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      await uploadBusinessPhotos(business.id, files);
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
    if (!business) {
      return;
    }

    setFeedback(null);

    try {
      await removeBusinessPhoto(business.id, photoUrl);
      setFeedbackTone("success");
      setFeedback("Photo removed.");
    } catch (removeError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(removeError));
    }
  }

  return (
    <ProtectedRoute>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Owner dashboard
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Manage your listing.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                Your updates publish directly to the public directory. Focus on
                accurate hours first, then keep the rest of the profile fresh.
              </p>
            </div>

            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm text-accentSoft transition hover:bg-accent/15"
              >
                Open admin workspace
              </Link>
            ) : null}
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

        {loading ? (
          <div className="mt-6">
            <StatePanel
              title="Loading your business"
              description="Your linked listing is being fetched from Firestore."
            />
          </div>
        ) : error ? (
          <div className="mt-6">
            <StatePanel title="Unable to load listing" description={error} />
          </div>
        ) : !profile?.businessId ? (
          <div className="mt-6">
            <StatePanel
              title="No business is linked to this account"
              description="Add a businessId to the user's Firestore document or assign the account from the admin workspace."
            />
          </div>
        ) : !business ? (
          <div className="mt-6">
            <StatePanel
              title="Linked listing not found"
              description="The business document tied to this account could not be found. Check the user's businessId in Firestore."
            />
          </div>
        ) : (
          <div className="mt-6">
            <BusinessEditorForm
              initialValues={business}
              title="Listing editor"
              description="Edit the public details for your Milwaukee listing. Address changes will try to refresh the map coordinates automatically."
              submitLabel="Save listing"
              onSubmit={handleSave}
              onUploadPhotos={handleUpload}
              onRemovePhoto={handleRemove}
              saving={saving}
              uploading={uploading}
            />
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
