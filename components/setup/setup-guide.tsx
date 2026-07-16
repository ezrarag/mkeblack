"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/providers/auth-provider";
import { useBusiness } from "@/hooks/use-business";
import {
  SetupGuideAudience,
  SetupGuideTask,
  ThemePreference,
  VisitorOrientation,
  useThemeSettings
} from "@/components/providers/theme-provider";
import { Business } from "@/lib/types";
import { cn } from "@/lib/utils";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  description: string;
}> = [
  {
    value: "system",
    label: "System",
    description: "Match this device automatically."
  },
  {
    value: "light",
    label: "Light",
    description: "Use the daytime directory view."
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use the nighttime directory view."
  }
];

const orientationOptions: Array<{
  value: VisitorOrientation;
  label: string;
  description: string;
}> = [
  {
    value: "browsing",
    label: "I'm browsing",
    description: "Show discovery and saved places first."
  },
  {
    value: "business",
    label: "I own/manage a business",
    description: "Prioritize listing, claim, and membership prompts."
  },
  {
    value: "events_offers",
    label: "Events and offers",
    description: "Surface community events and marketplace items."
  }
];

function taskIsComplete(completedTaskIds: string[], taskId: string) {
  return completedTaskIds.includes(taskId);
}

function buildMessagingTask({
  userAudience,
  business,
  completedTaskIds,
  completeSetupTask
}: {
  userAudience: SetupGuideAudience;
  business: Business | null;
  completedTaskIds: string[];
  completeSetupTask: (taskId: string) => void;
}): SetupGuideTask {
  const status: SetupGuideTask["status"] = taskIsComplete(completedTaskIds, "chat")
    ? "complete"
    : "todo";

  const linkClass =
    "inline-flex rounded-full border border-accent bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accentSoft";
  const softLinkClass =
    "inline-flex rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accentSoft transition hover:bg-accent/15";

  if (userAudience === "admin") {
    return {
      id: "chat",
      title: "Visitor messaging is live",
      description:
        "Signed-in visitors can now message Solidarity Circle businesses directly about prices, events, and reviews. Track adoption and demographics from the Visitors analytics page.",
      status,
      audience: "admin",
      action: (
        <Link href="/admin/visitors" onClick={() => completeSetupTask("chat")} className={linkClass}>
          Open visitor analytics →
        </Link>
      )
    };
  }

  if (userAudience === "business") {
    if (business?.solidarityMember) {
      return {
        id: "chat",
        title: "Check your message inbox",
        description:
          "Visitors can now message you directly from your listing — about marketplace prices, events, or anything else. Reply from your dashboard’s Messages tab.",
        status,
        audience: "business",
        action: (
          <Link href="/dashboard?tab=messages" onClick={() => completeSetupTask("chat")} className={linkClass}>
            Open messages →
          </Link>
        )
      };
    }

    return {
      id: "chat",
      title: "Unlock direct visitor messages",
      description:
        "Solidarity Circle members get a messages inbox so visitors can ask about prices, events, and products straight from your listing.",
      status,
      audience: "business",
      action: (
        <Link href="/membership" onClick={() => completeSetupTask("chat")} className={softLinkClass}>
          Learn about Solidarity Circle →
        </Link>
      )
    };
  }

  if (userAudience === "visitor") {
    return {
      id: "chat",
      title: "Try messaging a business",
      description:
        "Solidarity Circle businesses can answer your questions about prices, products, and events — right from their listing page. Look for the “Message this business” button.",
      status,
      audience: "visitor",
      action: (
        <Link href="/directory" onClick={() => completeSetupTask("chat")} className={linkClass}>
          Browse the directory →
        </Link>
      )
    };
  }

  return {
    id: "chat",
    title: "Message businesses directly",
    description:
      "Create a free account to message Solidarity Circle businesses about prices, events, and products — and to leave reviews after a purchase.",
    status,
    audience: "all",
    action: (
      <Link href="/join" onClick={() => completeSetupTask("chat")} className={linkClass}>
        Create your account →
      </Link>
    )
  };
}

export function SetupGuideTrigger({
  onClick,
  className
}: {
  onClick: () => void;
  className?: string;
}) {
  const { resolvedTheme, setupGuideNeedsAttention } = useThemeSettings();

  return (
    <button
      type="button"
      aria-label="Open setup guide"
      onClick={onClick}
      className={cn(
        "relative inline-flex h-10 items-center gap-2 rounded-full border border-line bg-panelAlt/70 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:border-accent/45 hover:bg-accent/10 hover:text-accent",
        className
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-canvas">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full border border-accent transition",
            resolvedTheme === "dark" ? "bg-accent" : "bg-transparent"
          )}
        />
      </span>
      <span>Setup</span>
      {setupGuideNeedsAttention ? (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-charcoal bg-accent" />
      ) : null}
    </button>
  );
}

export function SetupGuideDrawer({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const {
    themePreference,
    setupGuideState,
    setThemePreference,
    setVisitorOrientation,
    completeSetupTask,
    dismissSetupGuide,
    resetSetupGuide
  } = useThemeSettings();
  const { profile, hasAdminAccess, hasBusinessAccess, isVisitor } = useAuth();
  const { business } = useBusiness(profile?.businessId ?? "");

  const userAudience = hasAdminAccess
    ? "admin"
    : hasBusinessAccess
      ? "business"
      : isVisitor
        ? "visitor"
        : "all";

  const tasks = useMemo<SetupGuideTask[]>(() => {
    const themeComplete =
      themePreference !== "system" ||
      taskIsComplete(setupGuideState.completedTaskIds, "theme");
    const orientationComplete = taskIsComplete(
      setupGuideState.completedTaskIds,
      "orientation"
    );

    return [
      {
        id: "theme",
        title: "Choose your display",
        description: "Set how MKE Black should appear on this device.",
        status: themeComplete ? "complete" : "todo",
        audience: "all",
        action: (
          <div className="grid gap-2 sm:grid-cols-3">
            {themeOptions.map((option) => {
              const selected = themePreference === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setThemePreference(option.value);
                    completeSetupTask("theme");
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition",
                    selected
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line bg-canvas/60 text-stone-300 hover:border-accent/35 hover:text-ink"
                  )}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-stone-400">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        )
      },
      {
        id: "orientation",
        title: "Tell us what to prioritize",
        description: "This stays on your device in v1 and helps shape future prompts.",
        status: orientationComplete ? "complete" : "todo",
        audience: "all",
        action: (
          <div className="grid gap-2">
            {orientationOptions.map((option) => {
              const selected = setupGuideState.orientation === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisitorOrientation(option.value)}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition",
                    selected
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line bg-canvas/60 text-stone-300 hover:border-accent/35 hover:text-ink"
                  )}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-stone-400">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        )
      },
      buildMessagingTask({
        userAudience,
        business,
        completedTaskIds: setupGuideState.completedTaskIds,
        completeSetupTask
      })
    ];
  }, [
    business,
    completeSetupTask,
    setThemePreference,
    setVisitorOrientation,
    setupGuideState.completedTaskIds,
    setupGuideState.orientation,
    themePreference,
    userAudience
  ]);

  const visibleTasks = tasks.filter((task) => task.status !== "disabled");
  const completedCount = visibleTasks.filter((task) => task.status === "complete").length;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close setup guide"
        className="fixed inset-0 z-40 cursor-default bg-black/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 shadow-glow sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-accentSoft">
              Setup guide
            </p>
            <h2 className="mt-3 font-display text-2xl font-black text-ink">
              Tune your MKE Black experience
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Complete the basics now. This guide will become more personal as
              account, business, and membership features mature.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-line px-3 py-2 text-xs font-semibold text-stone-400 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-panelAlt/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">
              Progress
            </p>
            <p className="text-xs font-semibold text-stone-300">
              {completedCount} of {visibleTasks.length} complete
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas/70">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${visibleTasks.length ? (completedCount / visibleTasks.length) * 100 : 0}%`
              }}
            />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {visibleTasks.map((task) => (
            <section
              key={task.id}
              className="rounded-2xl border border-line bg-panelAlt/45 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    {task.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-stone-400">
                    {task.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    task.status === "complete"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-line bg-canvas/50 text-muted"
                  )}
                >
                  {task.status === "complete" ? "Done" : "Todo"}
                </span>
              </div>
              {task.action ? <div className="mt-4">{task.action}</div> : null}
            </section>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => {
              dismissSetupGuide();
              onClose();
            }}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Hide guide
          </button>
          <button
            type="button"
            onClick={resetSetupGuide}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-stone-400 transition hover:border-accent/35 hover:text-ink"
          >
            Reset
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}
