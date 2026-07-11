"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { WHO_WE_ARE_HERO_DEFAULTS } from "@/components/who-we-are/who-we-are-page";
import { useDirectoryHeroConfig } from "@/hooks/use-directory-hero-config";
import { usePageHeroContent } from "@/hooks/use-page-hero-content";
import { savePageHeroContent } from "@/lib/firebase/page-content";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { PageHeroContent } from "@/lib/types";

function HeroEditor({ title, pagePath, configId, content }: { title: string; pagePath: string; configId: string; content: PageHeroContent }) {
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => setDraft(content), [content]);

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      await savePageHeroContent(configId, draft);
      setFeedback("Saved. The public page has been updated.");
    } catch (error) {
      setFeedback(formatFirebaseError(error));
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-5">
      <div className="flex items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-bold text-ink">{title}</h2><p className="text-xs text-muted">{pagePath} hero</p></div></div>
      <div className="mt-5 grid gap-4">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Eyebrow<input className="mt-2" value={draft.eyebrow} onChange={(event) => setDraft({ ...draft, eyebrow: event.target.value })} /></label>
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Headline<input className="mt-2" value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} /></label>
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Subtitle / description<textarea className="mt-2 min-h-32" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <div><button type="button" onClick={() => void save()} disabled={saving || !draft.headline.trim()} className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save content"}</button></div>
        {feedback ? <p className="text-sm text-stone-300">{feedback}</p> : null}
      </div>
    </div>
  );
}

function PageContentManagementContent() {
  const { config } = useDirectoryHeroConfig();
  const who = usePageHeroContent("who_we_are_page", WHO_WE_ARE_HERO_DEFAULTS);
  return <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><div className="rounded-2xl border border-line bg-panel/80 p-6"><p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">Admin</p><h1 className="mt-2 font-display text-4xl font-black text-ink">Page content</h1><p className="mt-3 text-stone-300">Edit public-page hero headings and descriptions.</p></div><div className="mt-6 grid gap-6"><HeroEditor title="Directory" pagePath="/directory" configId="directory_page" content={config} /><HeroEditor title="Who We Are / Board" pagePath="/who-we-are" configId="who_we_are_page" content={who} /></div></section>;
}

export function PageContentManagementPage() { return <ProtectedRoute requireAdmin><PageContentManagementContent /></ProtectedRoute>; }
