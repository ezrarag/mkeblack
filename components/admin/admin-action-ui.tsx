"use client";

import { useEffect, useRef } from "react";

export function AdminFeedback({
  message,
  tone
}: {
  message: string;
  tone: "success" | "error";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-danger/35 bg-danger/10 text-rose-200"
          : "border-success/35 bg-success/10 text-stone-100"
      }`}
    >
      <span aria-hidden="true" className="mt-0.5 font-bold">
        {tone === "error" ? "!" : "✓"}
      </span>
      <span>{message}</span>
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete permanently",
  busy = false,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-description"
        className="w-full max-w-md rounded-2xl border border-danger/30 bg-panel p-5 shadow-glow sm:p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-300">
          Confirm destructive action
        </p>
        <h2 id="admin-confirm-title" className="mt-2 font-display text-2xl font-bold text-ink">
          {title}
        </h2>
        <p id="admin-confirm-description" className="mt-3 text-sm leading-6 text-stone-300">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-full border border-line px-5 py-2 text-sm font-semibold text-stone-200 transition hover:border-accent/40 hover:bg-panelAlt disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 rounded-full border border-danger/50 bg-danger/15 px-5 py-2 text-sm font-semibold text-rose-200 transition hover:bg-danger/25 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
