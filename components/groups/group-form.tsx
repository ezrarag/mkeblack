"use client";

import { FormEvent, useMemo, useState } from "react";
import { useBusinesses } from "@/hooks/use-businesses";
import { createGroup, updateGroup } from "@/lib/firebase/groups";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { Group } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Create-or-edit form for visitor-run community groups. Anyone signed in can
 * start a group and optionally tie it to a business — these are fan/community
 * groups, not official business pages, so the business link is just a tag.
 */
export function GroupForm({
  authorUid,
  authorName,
  existingGroup,
  onSaved,
  onCancel
}: {
  authorUid: string;
  authorName: string;
  existingGroup?: Group | null;
  onSaved?: (groupId: string) => void;
  onCancel?: () => void;
}) {
  const { businesses } = useBusinesses();
  const [name, setName] = useState(existingGroup?.name ?? "");
  const [description, setDescription] = useState(existingGroup?.description ?? "");
  const [businessQuery, setBusinessQuery] = useState(existingGroup?.businessName ?? "");
  const [businessId, setBusinessId] = useState<string | null>(existingGroup?.businessId ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const query = businessQuery.trim().toLowerCase();
    if (!query || (businessId && businesses.find((b) => b.id === businessId)?.name.toLowerCase() === query)) {
      return [];
    }
    return businesses
      .filter((business) => business.active && business.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [businessQuery, businesses, businessId]);

  function selectBusiness(id: string, label: string) {
    setBusinessId(id);
    setBusinessQuery(label);
  }

  function clearBusiness() {
    setBusinessId(null);
    setBusinessQuery("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError("Give your group a name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const businessName = businessId
        ? businesses.find((business) => business.id === businessId)?.name ?? businessQuery.trim()
        : null;

      if (existingGroup) {
        await updateGroup(existingGroup.id, {
          name,
          description,
          businessId,
          businessName
        });
        onSaved?.(existingGroup.id);
      } else {
        const groupId = await createGroup({
          name,
          description,
          businessId,
          businessName,
          creatorUid: authorUid,
          creatorName: authorName
        });
        onSaved?.(groupId);
      }
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panelAlt/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        {existingGroup ? "Edit group" : "Start a community group"}
      </p>
      <p className="mt-2 text-sm leading-7 text-stone-400">
        Groups are run by the people who create them — like a fan club or
        regulars&rsquo; crew for a favorite spot. You&rsquo;ll be the owner and can invite
        others to join in once it&rsquo;s live.
      </p>

      <div className="mt-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
          Group name
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder="e.g. Sherman Phoenix Regulars"
        />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
          What&rsquo;s this group about?
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Tell people what to expect — what you'll share, plan, or celebrate together."
          className="w-full resize-none rounded-xl border border-line bg-canvas/60 px-4 py-3 text-sm text-ink placeholder-stone-500 transition focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="relative mt-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
          Tag a business (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            value={businessQuery}
            onChange={(event) => {
              setBusinessQuery(event.target.value);
              if (businessId) setBusinessId(null);
            }}
            placeholder="Search businesses to connect this group to"
          />
          {businessId ? (
            <button
              type="button"
              onClick={clearBusiness}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
            >
              Clear
            </button>
          ) : null}
        </div>
        {matches.length ? (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-line bg-canvas shadow-glow">
            {matches.map((business) => (
              <button
                key={business.id}
                type="button"
                onClick={() => selectBusiness(business.id, business.name)}
                className="block w-full px-4 py-2.5 text-left text-sm text-stone-200 transition hover:bg-panelAlt/70 hover:text-ink"
              >
                {business.name}
                <span className="ml-2 text-xs text-stone-500">{business.category}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-400">{error}</p> : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "inline-flex rounded-full border border-accent bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:opacity-60"
          )}
        >
          {saving ? "Saving…" : existingGroup ? "Save changes" : "Create group"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
