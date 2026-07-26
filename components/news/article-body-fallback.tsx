/**
 * Graceful degradation for the article detail page. Rendered instead of
 * the markdown body whenever we can't show the real content, so a legacy
 * or not-yet-backfilled article never presents as a broken page.
 *
 * - "missing-body": the article doc exists (metadata is real) but `body`
 *   hasn't been backfilled from the legacy archive yet. This is the
 *   expected, common case during the backfill window.
 * - "unavailable": the Firestore/Admin SDK lookup itself failed (network
 *   blip, credential issue, etc). We still don't want to throw or hard
 *   404 here — show a lightweight retry-friendly message instead.
 */
export function ArticleBodyFallback({
  variant = "missing-body",
  sourceHref
}: {
  variant?: "missing-body" | "unavailable";
  sourceHref?: string;
}) {
  const message =
    variant === "unavailable"
      ? "This article is temporarily unavailable while we reconnect to the archive. Please refresh in a moment."
      : "This article has been preserved in the MKE Black archive, but the full body has not been backfilled into Firebase yet.";

  return (
    <article className="rounded-[2rem] border border-line bg-panel/85 p-6 shadow-glow sm:p-8">
      <p className="text-sm leading-7 text-stone-300">{message}</p>
      {sourceHref ? (
        <a
          href={sourceHref}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex rounded-full border border-line px-5 py-3 text-sm font-semibold text-stone-300 transition hover:border-accent/40 hover:text-accentSoft"
        >
          Open original source
        </a>
      ) : null}
    </article>
  );
}
