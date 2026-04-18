"use client";

import Link from "next/link";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BusinessEditorForm } from "@/components/forms/business-editor-form";
import { StatePanel } from "@/components/ui/state-panel";
import { useBusiness } from "@/hooks/use-business";
import { businessToFormValues } from "@/lib/businesses";
import {
  removeBusinessPhoto,
  saveBusiness,
  sendBusinessClaimInvite,
  uploadBusinessPhotos
} from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessFormValues } from "@/lib/types";

type BusinessEditPageProps = {
  businessId: string;
};

export function BusinessEditPage({ businessId }: BusinessEditPageProps) {
  const { business, loading, error } = useBusiness(businessId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inviting, setInviting] = useState(false);
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
      setFeedback("Business saved.");
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

  async function handleClaimInvite() {
    if (!business) {
      return;
    }

    setInviting(true);
    setFeedback(null);

    try {
      await sendBusinessClaimInvite(business, window.location.origin);
      setFeedbackTone("success");
      setFeedback(
        `Claim invite queued for ${business.email}. The recipient can finish account creation from the emailed claim link.`
      );
    } catch (inviteError) {
      setFeedbackTone("error");
      setFeedback(formatFirebaseError(inviteError));
    } finally {
      setInviting(false);
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Business edit
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                {loading ? "Loading..." : business?.name || "Business"}
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/businesses"
                className="rounded-full border border-line px-5 py-3 text-sm text-stone-200 transition hover:border-accent/35 hover:text-accentSoft"
              >
                Back to business manager
              </Link>
              <button
                type="button"
                onClick={() => void handleClaimInvite()}
                disabled={inviting || !business?.email}
                className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm font-medium text-accentSoft transition hover:bg-accent/15"
              >
                {inviting ? "Sending invite..." : "Claim this listing"}
              </button>
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

        {loading ? (
          <div className="mt-6">
            <StatePanel
              title="Loading business"
              description="Fetching the selected listing from Firestore."
            />
          </div>
        ) : error ? (
          <div className="mt-6">
            <StatePanel title="Unable to load business" description={error} />
          </div>
        ) : !business ? (
          <div className="mt-6">
            <StatePanel
              title="Business not found"
              description="This listing could not be loaded."
            />
          </div>
        ) : (
          <div className="mt-6">
            <BusinessEditorForm
              initialValues={businessToFormValues(business)}
              title="Full business editor"
              description="Update all public listing fields, normalize imported hours, refine the map pin, and queue an owner-claim invite when the email is ready."
              submitLabel="Save business"
              onSubmit={handleSave}
              onUploadPhotos={handleUpload}
              onRemovePhoto={handleRemove}
              saving={saving}
              uploading={uploading}
              showAdminFields
            />
          </div>
        )}
      </section>
    </ProtectedRoute>
  );
}
