"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { BusinessEditorForm } from "@/components/forms/business-editor-form";
import { BusinessTeamManager } from "@/components/forms/business-team-manager";
import { BusinessMarketplaceManager } from "@/components/marketplace/business-marketplace-manager";
import { MessagesPanel } from "@/components/messages/messages-panel";
import { BusinessEventsManager } from "@/components/events/business-events-manager";
import { BusinessEmailClaimSuggestion } from "@/components/dashboard/business-email-claim-suggestion";
import { BusinessClaimSearch } from "@/components/dashboard/business-claim-search";
import { PendingBusinessSubmissions } from "@/components/dashboard/pending-business-submissions";
import { StatePanel } from "@/components/ui/state-panel";
import { useBusiness } from "@/hooks/use-business";
import { businessToFormValues } from "@/lib/businesses";
import {
  removeBusinessPhoto,
  saveBusiness,
  uploadBusinessPhotos
} from "@/lib/firebase/businesses";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { BusinessFormValues } from "@/lib/types";

type DashboardTab = "listing" | "team" | "marketplace" | "messages" | "events";
const DASHBOARD_TABS: DashboardTab[] = ["listing", "team", "marketplace", "messages", "events"];

function isValidDashboardTab(value: string | null): value is DashboardTab {
  return !!value && (DASHBOARD_TABS as string[]).includes(value);
}

export function DashboardPageContent() {
  const { user, profile, hasAdminAccess } = useAuth();
  const { business, loading, error } = useBusiness(profile?.businessId ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<DashboardTab>(
    isValidDashboardTab(requestedTab) ? requestedTab : "listing"
  );

  useEffect(() => {
    if (isValidDashboardTab(requestedTab)) {
      setActiveTab(requestedTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab]);
  const [hasPendingSubmissions, setHasPendingSubmissions] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");

  async function handleSave(values: BusinessFormValues) {
    if (!business) return;
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
    if (!business) return;
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
    if (!business) return;
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

  // Called after a successful self-claim — refresh auth profile + business
  function handleClaimed() {
    // Force a page reload so the auth context re-reads the updated
    // users/{uid} doc which now has businessId set
    window.location.reload();
  }

  const handlePendingSubmissionsChange = useCallback((hasPending: boolean) => {
    setHasPendingSubmissions(hasPending);
  }, []);

  return (
    <ProtectedRoute>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="rounded-2xl border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Owner dashboard
              </p>
              <h1 className="mt-3 font-display text-4xl font-black leading-tight text-ink sm:text-6xl">
                {loading
                  ? "Loading your listing…"
                  : business
                  ? business.name
                  : hasPendingSubmissions
                  ? "Business request pending"
                  : "My Listing"}
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                {business
                  ? "Updates you make here publish directly to the public MKE Black directory. Keep your hours accurate — that's what people search by most."
                  : hasPendingSubmissions
                  ? "Your business listing request is waiting for admin approval. You can track status, attach Google, and start Solidarity Circle membership while you wait."
                  : "Find or claim your business listing to manage it from this dashboard."}
              </p>
            </div>

            {hasAdminAccess ? (
              <Link
                href="/admin"
                className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm text-accentSoft transition hover:bg-accent/15"
              >
                Open admin workspace →
              </Link>
            ) : null}
          </div>

          {/* Quick-stat strip */}
          {business ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Status</p>
                <p className={`mt-2 text-sm font-medium ${business.active ? "text-green-400" : "text-rose-400"}`}>
                  {business.active ? "● Live in directory" : "● Not visible publicly"}
                </p>
              </div>
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Category</p>
                <p className="mt-2 text-sm font-medium text-stone-100">{business.category || "—"}</p>
              </div>
              <div className="rounded-3xl border border-line bg-panelAlt/70 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Photos</p>
                <p className="mt-2 text-sm font-medium text-stone-100">
                  {business.photos.length} uploaded
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Feedback banner ── */}
        {feedback ? (
          <div className={`mt-6 rounded-3xl px-5 py-4 text-sm ${
            feedbackTone === "success"
              ? "border border-success/35 bg-success/10 text-stone-100"
              : "border border-danger/35 bg-danger/10 text-stone-100"
          }`}>
            {feedback}
          </div>
        ) : null}

        {/* ── States ── */}
        {loading ? (
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-line bg-panel/60" />
            ))}
          </div>

        ) : error ? (
          <div className="mt-6">
            <StatePanel title="Unable to load listing" description={error} />
          </div>

        ) : !profile?.businessId ? (
          /* ── No business linked yet: show search + claim ── */
          <>
            <PendingBusinessSubmissions
              onHasPendingChange={handlePendingSubmissionsChange}
            />

            {!hasPendingSubmissions ? (
              <>
                <BusinessEmailClaimSuggestion />
                <BusinessClaimSearch onClaimed={handleClaimed} />
              </>
            ) : null}

            {/* Admin UID debug block */}
            {hasAdminAccess && user ? (
              <div className="mt-4 rounded-2xl border border-line/80 bg-canvas/40 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Admin — Firebase UID</p>
                <code className="mt-2 block break-all text-sm text-stone-300">{user.uid}</code>
              </div>
            ) : null}
          </>

        ) : !business ? (
          <div className="mt-6">
            <StatePanel
              title="Listing not found"
              description="Your account is linked but the business record couldn't be loaded. Contact MKE Black for help."
              action={
                <a
                  href="https://www.mkeblack.org/contact"
                  className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accentSoft"
                >
                  Contact MKE Black
                </a>
              }
            />
          </div>

        ) : (
          <div className="mt-6">
            <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-line bg-panel/80 p-2">
              {DASHBOARD_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-5 py-3 text-sm transition ${
                    activeTab === tab
                      ? "bg-accent text-white"
                      : "text-stone-200 hover:bg-accent/10 hover:text-accentSoft"
                  }`}
                >
                  {tab === "listing"
                    ? "Listing"
                    : tab === "team"
                    ? "Team"
                    : tab === "marketplace"
                    ? "Marketplace"
                    : tab === "messages"
                    ? "Messages"
                    : "Events"}
                </button>
              ))}
            </div>

            {activeTab === "listing" ? (
              <BusinessEditorForm
                initialValues={businessToFormValues(business)}
                title="Edit your listing"
                description="Your changes go live on the public directory as soon as you save. Start with hours — that's the #1 thing people filter by."
                submitLabel="Save changes"
                onSubmit={handleSave}
                onUploadPhotos={handleUpload}
                onRemovePhoto={handleRemove}
                saving={saving}
                uploading={uploading}
                showAdminFields={false}
                showInternalFields={false}
              />
            ) : activeTab === "team" ? (
              <BusinessTeamManager businessId={business.id} />
            ) : activeTab === "marketplace" ? (
              <BusinessMarketplaceManager
                businessId={business.id}
                businessName={business.name}
                isSolidarityMember={business.solidarityMember}
              />
            ) : activeTab === "messages" ? (
              business.solidarityMember ? (
                <MessagesPanel
                  side="business"
                  selfId={user?.uid ?? ""}
                  selfName={business.name}
                  threadKey={business.id}
                />
              ) : (
                <div className="rounded-2xl border border-line bg-panel/80 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">
                    Messages
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                    Solidarity Circle members only
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-stone-300">
                    Visitors can message Solidarity Circle businesses directly
                    about marketplace items, events, and prices. Join to start
                    those conversations.
                  </p>
                  <Link
                    href="/membership"
                    className="mt-5 inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
                  >
                    Upgrade to Solidarity Circle
                  </Link>
                </div>
              )
            ) : (
              <BusinessEventsManager
                businessId={business.id}
                businessName={business.name}
                isSolidarityMember={business.solidarityMember}
              />
            )}
          </div>
        )}

      </section>
    </ProtectedRoute>
  );
}
