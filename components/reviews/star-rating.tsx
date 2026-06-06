"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

/** Static star display — used for summaries and read-only review cards. */
export function StarDisplay({
  rating,
  size = "sm",
  className
}: {
  rating: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const dimension = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const rounded = Math.round(rating);

  return (
    <div className={cn("flex items-center gap-0.5 text-accent", className)} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} filled={value <= rounded} className={dimension} />
      ))}
    </div>
  );
}

/** Interactive star picker — used in the review form. */
export function StarPicker({
  value,
  onChange,
  className
}: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div className={cn("flex items-center gap-1 text-accent", className)} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={`${option} star${option === 1 ? "" : "s"}`}
          onMouseEnter={() => setHovered(option)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(option)}
          className="rounded-full p-0.5 transition hover:scale-110"
        >
          <Star filled={option <= active} className="h-7 w-7" />
        </button>
      ))}
    </div>
  );
}
