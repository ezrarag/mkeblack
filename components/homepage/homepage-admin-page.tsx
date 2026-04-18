"use client";

import Link from "next/link";
import {
  DragControls,
  Reorder,
  useDragControls
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { StatePanel } from "@/components/ui/state-panel";
import { formatFirebaseError } from "@/lib/firebase-errors";
import {
  HOMEPAGE_MODULE_LABELS,
  HOMEPAGE_MODULE_TYPES,
  cloneHomepageModule,
  cloneMemberDiscount,
  createHomepageModuleDraft,
  createMemberDiscountDraft,
  syncHomepageModuleOrder,
  syncMemberDiscountOrder
} from "@/lib/homepage";
import {
  createHomepageModule,
  createMemberDiscount,
  saveHomepageModule,
  saveHomepageModuleArrangement,
  saveMemberDiscount,
  saveMemberDiscountArrangement
} from "@/lib/firebase/homepage";
import { useHomepageModules } from "@/hooks/use-homepage-modules";
import { useMemberDiscounts } from "@/hooks/use-member-discounts";
import {
  HomepageModule,
  HomepageModuleType,
  MemberDiscount
} from "@/lib/types";

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

function Toggle({
  checked,
  label,
  onClick
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      aria-label={label}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        checked
          ? "border-accent/35 bg-accent/15"
          : "border-line bg-panelAlt/70"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-ink transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SortHandle({
  controls,
  label
}: {
  controls: DragControls;
  label: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(event) => controls.start(event)}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-panelAlt/70 text-muted transition hover:border-accent/35 hover:text-accentSoft"
      aria-label={label}
    >
      <span className="text-lg leading-none">⋮⋮</span>
    </button>
  );
}

function HomepageModuleRow({
  module,
  onToggleVisible,
  onEdit
}: {
  module: HomepageModule;
  onToggleVisible: (moduleId: string) => void;
  onEdit: (module: HomepageModule) => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={module}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
    >
      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] border border-line bg-panelAlt/70 p-4">
        <SortHandle controls={dragControls} label={`Reorder ${module.title}`} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-stone-100">
              {module.title || HOMEPAGE_MODULE_LABELS[module.type]}
            </p>
            <span className="rounded-full border border-line px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
              {HOMEPAGE_MODULE_LABELS[module.type]}
            </span>
          </div>
          <p className="mt-2 text-sm text-stone-400">
            Order {module.order + 1}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Visible</p>
          </div>
          <Toggle
            checked={module.visible}
            label={`Toggle visibility for ${module.title}`}
            onClick={() => onToggleVisible(module.id)}
          />
          <button
            type="button"
            onClick={() => onEdit(module)}
            className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm text-accentSoft transition hover:bg-accent/15"
          >
            Edit
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

function MemberDiscountRow({
  discount,
  onToggleActive,
  onEdit
}: {
  discount: MemberDiscount;
  onToggleActive: (discountId: string) => void;
  onEdit: (discount: MemberDiscount) => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={discount}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
    >
      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] border border-line bg-panelAlt/70 p-4">
        <SortHandle
          controls={dragControls}
          label={`Reorder ${discount.businessName || "discount"}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-stone-100">
              {discount.businessName || "Untitled discount"}
            </p>
            <span className="rounded-full border border-line px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
              Offer
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-stone-400">
            {discount.discountText || "Add the offer copy in the editor."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Active</p>
          </div>
          <Toggle
            checked={discount.active}
            label={`Toggle active state for ${discount.businessName || "discount"}`}
            onClick={() => onToggleActive(discount.id)}
          />
          <button
            type="button"
            onClick={() => onEdit(discount)}
            className="rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm text-accentSoft transition hover:bg-accent/15"
          >
            Edit
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

function ModuleEditor({
  module,
  saving,
  onClose,
  onSave,
  onChange
}: {
  module: HomepageModule;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (nextModule: HomepageModule) => void;
}) {
  const panelTitle = `${HOMEPAGE_MODULE_LABELS[module.type]} editor`;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6 shadow-glow sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accentSoft">
              {panelTitle}
            </p>
            <h2 className="mt-2 font-display text-4xl leading-none text-ink">
              Edit module
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-2 text-sm text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Close
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Section title
            </label>
            <input
              value={module.title}
              onChange={(event) =>
                onChange({
                  ...module,
                  title: event.target.value
                })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-3xl border border-line bg-panelAlt/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-stone-100">Visible on homepage</p>
              <p className="text-xs text-stone-400">
                This also controls the public section query.
              </p>
            </div>
            <Toggle
              checked={module.visible}
              label={`Toggle visibility for ${module.title}`}
              onClick={() =>
                onChange({
                  ...module,
                  visible: !module.visible
                })
              }
            />
          </div>

          {module.type === "hero" ? (
            <>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Headline
                </label>
                <textarea
                  value={module.content.headline}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        headline: event.target.value
                      }
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Subheadline
                </label>
                <textarea
                  value={module.content.subheadline}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        subheadline: event.target.value
                      }
                    })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Primary CTA label
                  </label>
                  <input
                    value={module.content.ctaPrimary.label}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          ctaPrimary: {
                            ...module.content.ctaPrimary,
                            label: event.target.value
                          }
                        }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Primary CTA href
                  </label>
                  <input
                    value={module.content.ctaPrimary.href}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          ctaPrimary: {
                            ...module.content.ctaPrimary,
                            href: event.target.value
                          }
                        }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Secondary CTA label
                  </label>
                  <input
                    value={module.content.ctaSecondary.label}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          ctaSecondary: {
                            ...module.content.ctaSecondary,
                            label: event.target.value
                          }
                        }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    Secondary CTA href
                  </label>
                  <input
                    value={module.content.ctaSecondary.href}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          ctaSecondary: {
                            ...module.content.ctaSecondary,
                            href: event.target.value
                          }
                        }
                      })
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          {module.type === "featured_articles" ? (
            <>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Intro text
                </label>
                <textarea
                  value={module.content.description}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        description: event.target.value
                      }
                    })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    CTA label
                  </label>
                  <input
                    value={module.content.ctaLabel}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          ctaLabel: event.target.value
                        }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    CTA href
                  </label>
                  <input
                    value={module.content.ctaHref}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          ctaHref: event.target.value
                        }
                      })
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          {module.type === "membership_cta" ? (
            <>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Description
                </label>
                <textarea
                  value={module.content.description}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        description: event.target.value
                      }
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Benefits list
                </label>
                <textarea
                  value={module.content.benefits.join("\n")}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        benefits: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                      }
                    })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    CTA label
                  </label>
                  <input
                    value={module.content.cta.label}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          cta: {
                            ...module.content.cta,
                            label: event.target.value
                          }
                        }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                    CTA href
                  </label>
                  <input
                    value={module.content.cta.href}
                    onChange={(event) =>
                      onChange({
                        ...module,
                        content: {
                          ...module.content,
                          cta: {
                            ...module.content.cta,
                            href: event.target.value
                          }
                        }
                      })
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          {module.type === "member_discounts" ? (
            <>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Description
                </label>
                <textarea
                  value={module.content.description}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        description: event.target.value
                      }
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Empty state copy
                </label>
                <textarea
                  value={module.content.emptyState}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        emptyState: event.target.value
                      }
                    })
                  }
                />
              </div>
            </>
          ) : null}

          {module.type === "editorial" ? (
            <>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Markdown body
                </label>
                <textarea
                  value={module.content.body}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        body: event.target.value
                      }
                    })
                  }
                  className="min-h-[220px]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Image URL
                </label>
                <input
                  value={module.content.imageUrl}
                  onChange={(event) =>
                    onChange({
                      ...module,
                      content: {
                        ...module.content,
                        imageUrl: event.target.value
                      }
                    })
                  }
                />
              </div>
            </>
          ) : null}

          {module.type === "custom" ? (
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Sanitized HTML
              </label>
              <textarea
                value={module.content.html}
                onChange={(event) =>
                  onChange({
                    ...module,
                    content: {
                      ...module.content,
                      html: event.target.value
                    }
                  })
                }
                className="min-h-[260px] font-mono text-xs"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
          >
            {saving ? "Saving..." : "Save module"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-6 py-3 text-sm text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Cancel
          </button>
        </div>
      </aside>
    </>
  );
}

function MemberDiscountEditor({
  discount,
  saving,
  onClose,
  onSave,
  onChange
}: {
  discount: MemberDiscount;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (nextDiscount: MemberDiscount) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6 shadow-glow sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-accentSoft">
              Member discount editor
            </p>
            <h2 className="mt-2 font-display text-4xl leading-none text-ink">
              Edit offer
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-2 text-sm text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Close
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Business name
            </label>
            <input
              value={discount.businessName}
              onChange={(event) =>
                onChange({
                  ...discount,
                  businessName: event.target.value
                })
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Logo URL
            </label>
            <input
              value={discount.logoUrl}
              onChange={(event) =>
                onChange({
                  ...discount,
                  logoUrl: event.target.value
                })
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Discount copy
            </label>
            <textarea
              value={discount.discountText}
              onChange={(event) =>
                onChange({
                  ...discount,
                  discountText: event.target.value
                })
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Business URL
            </label>
            <input
              value={discount.businessUrl}
              onChange={(event) =>
                onChange({
                  ...discount,
                  businessUrl: event.target.value
                })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-3xl border border-line bg-panelAlt/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-stone-100">Offer is active</p>
              <p className="text-xs text-stone-400">
                Inactive offers stay editable but disappear from the homepage.
              </p>
            </div>
            <Toggle
              checked={discount.active}
              label={`Toggle active state for ${discount.businessName || "discount"}`}
              onClick={() =>
                onChange({
                  ...discount,
                  active: !discount.active
                })
              }
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft"
          >
            {saving ? "Saving..." : "Save discount"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-6 py-3 text-sm text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
          >
            Cancel
          </button>
        </div>
      </aside>
    </>
  );
}

export function HomepageAdminPage() {
  const { profile } = useAuth();
  const {
    modules: homepageModules,
    loading: modulesLoading,
    error: modulesError
  } = useHomepageModules();
  const {
    discounts: memberDiscounts,
    loading: discountsLoading,
    error: discountsError
  } = useMemberDiscounts();
  const [modules, setModules] = useState<HomepageModule[]>([]);
  const [discounts, setDiscounts] = useState<MemberDiscount[]>([]);
  const [moduleDraft, setModuleDraft] = useState<HomepageModule | null>(null);
  const [discountDraft, setDiscountDraft] = useState<MemberDiscount | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [savingPanel, setSavingPanel] = useState(false);
  const moduleArrangementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discountArrangementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setModules(homepageModules.map((module) => cloneHomepageModule(module)));
  }, [homepageModules]);

  useEffect(() => {
    setDiscounts(memberDiscounts.map((discount) => cloneMemberDiscount(discount)));
  }, [memberDiscounts]);

  useEffect(() => {
    return () => {
      if (moduleArrangementTimerRef.current) {
        clearTimeout(moduleArrangementTimerRef.current);
      }

      if (discountArrangementTimerRef.current) {
        clearTimeout(discountArrangementTimerRef.current);
      }
    };
  }, []);

  function setFeedbackMessage(
    tone: "success" | "error",
    message: string
  ) {
    setFeedback({ tone, message });
  }

  function queueModuleArrangementSave(nextModules: HomepageModule[]) {
    setModules(nextModules);

    if (moduleArrangementTimerRef.current) {
      clearTimeout(moduleArrangementTimerRef.current);
    }

    moduleArrangementTimerRef.current = setTimeout(async () => {
      try {
        await saveHomepageModuleArrangement(
          nextModules.map((module) => ({
            id: module.id,
            visible: module.visible,
            order: module.order
          }))
        );
        setFeedbackMessage("success", "Homepage module order saved.");
      } catch (saveError) {
        setFeedbackMessage("error", formatFirebaseError(saveError));
      }
    }, 500);
  }

  function queueDiscountArrangementSave(nextDiscounts: MemberDiscount[]) {
    setDiscounts(nextDiscounts);

    if (discountArrangementTimerRef.current) {
      clearTimeout(discountArrangementTimerRef.current);
    }

    discountArrangementTimerRef.current = setTimeout(async () => {
      try {
        await saveMemberDiscountArrangement(
          nextDiscounts.map((discount) => ({
            id: discount.id,
            active: discount.active,
            order: discount.order
          }))
        );
        setFeedbackMessage("success", "Member discount order saved.");
      } catch (saveError) {
        setFeedbackMessage("error", formatFirebaseError(saveError));
      }
    }, 500);
  }

  async function handleCreateModule(type: HomepageModuleType) {
    setFeedback(null);

    try {
      const nextOrder = modules.length;
      const newId = await createHomepageModule(type, nextOrder);
      const nextModule = createHomepageModuleDraft(type);

      setShowTypePicker(false);
      setModuleDraft({
        ...nextModule,
        id: newId,
        order: nextOrder
      });
      setFeedbackMessage("success", "Homepage module created.");
    } catch (createError) {
      setFeedbackMessage("error", formatFirebaseError(createError));
    }
  }

  async function handleCreateDiscount() {
    setFeedback(null);

    try {
      const nextOrder = discounts.length;
      const newId = await createMemberDiscount(nextOrder);
      const nextDiscount = createMemberDiscountDraft();

      setDiscountDraft({
        ...nextDiscount,
        id: newId,
        order: nextOrder
      });
      setFeedbackMessage("success", "Member discount created.");
    } catch (createError) {
      setFeedbackMessage("error", formatFirebaseError(createError));
    }
  }

  async function handleSaveModule() {
    if (!moduleDraft) {
      return;
    }

    setSavingPanel(true);
    setFeedback(null);

    try {
      await saveHomepageModule(moduleDraft.id, moduleDraft);
      setModuleDraft(null);
      setFeedbackMessage("success", "Homepage module saved.");
    } catch (saveError) {
      setFeedbackMessage("error", formatFirebaseError(saveError));
    } finally {
      setSavingPanel(false);
    }
  }

  async function handleSaveDiscount() {
    if (!discountDraft) {
      return;
    }

    setSavingPanel(true);
    setFeedback(null);

    try {
      await saveMemberDiscount(discountDraft.id, discountDraft);
      setDiscountDraft(null);
      setFeedbackMessage("success", "Member discount saved.");
    } catch (saveError) {
      setFeedbackMessage("error", formatFirebaseError(saveError));
    } finally {
      setSavingPanel(false);
    }
  }

  if (profile?.role !== "admin") {
    return (
      <ProtectedRoute>
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <StatePanel
            title="Admin role required"
            description="Only users whose Firestore profile role is set to admin can manage homepage content."
          />
        </section>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2.6rem] border border-line bg-panel/80 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-accentSoft">
                Homepage workspace
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none text-ink sm:text-6xl">
                Control the public homepage.
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-stone-300">
                Toggle visibility, drag sections into order, and edit each module or
                member discount from one admin surface.
              </p>
            </div>

            <Link
              href="/admin"
              className="rounded-full border border-accent/35 bg-accent/10 px-5 py-3 text-sm text-accentSoft transition hover:bg-accent/15"
            >
              Back to listings
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Total modules
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {modulesLoading ? "--" : modules.length}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Visible modules
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {modulesLoading ? "--" : modules.filter((module) => module.visible).length}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Active discounts
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {discountsLoading ? "--" : discounts.filter((discount) => discount.active).length}
              </p>
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-6 rounded-3xl px-5 py-4 text-sm ${
              feedback.tone === "success"
                ? "border border-success/35 bg-success/10 text-stone-100"
                : "border border-danger/35 bg-danger/10 text-stone-100"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                    Homepage modules
                  </p>
                  <p className="mt-2 text-sm text-stone-400">
                    Reorder with the drag handle. Visibility autosaves after a short
                    delay.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTypePicker((current) => !current)}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:bg-accentSoft"
                >
                  Add module
                </button>
              </div>

              {showTypePicker ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {HOMEPAGE_MODULE_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => void handleCreateModule(type)}
                      className="rounded-3xl border border-line bg-panelAlt/70 px-4 py-4 text-left transition hover:border-accent/35 hover:bg-panelAlt/85"
                    >
                      <p className="font-medium text-stone-100">
                        {HOMEPAGE_MODULE_LABELS[type]}
                      </p>
                      <p className="mt-2 text-sm text-stone-400">
                        Create a new {HOMEPAGE_MODULE_LABELS[type].toLowerCase()} module.
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              {modulesLoading ? (
                <div className="mt-5 space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-[2rem] border border-line bg-panelAlt/70"
                    />
                  ))}
                </div>
              ) : modulesError ? (
                <div className="mt-5">
                  <StatePanel title="Unable to load modules" description={modulesError} />
                </div>
              ) : modules.length ? (
                <Reorder.Group
                  axis="y"
                  values={modules}
                  onReorder={(nextModules) =>
                    queueModuleArrangementSave(syncHomepageModuleOrder(nextModules))
                  }
                  className="mt-5 space-y-3"
                >
                  {modules.map((module) => (
                    <HomepageModuleRow
                      key={module.id}
                      module={module}
                      onToggleVisible={(moduleId) =>
                        queueModuleArrangementSave(
                          modules.map((currentModule) =>
                            currentModule.id === moduleId
                              ? {
                                  ...currentModule,
                                  visible: !currentModule.visible
                                }
                              : currentModule
                          )
                        )
                      }
                      onEdit={(selectedModule) => {
                        setDiscountDraft(null);
                        setModuleDraft(cloneHomepageModule(selectedModule));
                      }}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <div className="mt-5 rounded-[2rem] border border-dashed border-line bg-canvas/35 p-6 text-sm text-stone-300">
                  Add a module to start composing the homepage.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-line bg-panel/85 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
                  Member discounts
                </p>
                <p className="mt-2 text-sm text-stone-400">
                  Keep offers ordered and active from the same workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCreateDiscount()}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:bg-accentSoft"
              >
                New discount
              </button>
            </div>

            {discountsLoading ? (
              <div className="mt-5 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[2rem] border border-line bg-panelAlt/70"
                  />
                ))}
              </div>
            ) : discountsError ? (
              <div className="mt-5">
                <StatePanel
                  title="Unable to load member discounts"
                  description={discountsError}
                />
              </div>
            ) : discounts.length ? (
              <Reorder.Group
                axis="y"
                values={discounts}
                onReorder={(nextDiscounts) =>
                  queueDiscountArrangementSave(syncMemberDiscountOrder(nextDiscounts))
                }
                className="mt-5 space-y-3"
              >
                {discounts.map((discount) => (
                  <MemberDiscountRow
                    key={discount.id}
                    discount={discount}
                    onToggleActive={(discountId) =>
                      queueDiscountArrangementSave(
                        discounts.map((currentDiscount) =>
                          currentDiscount.id === discountId
                            ? {
                                ...currentDiscount,
                                active: !currentDiscount.active
                              }
                            : currentDiscount
                        )
                      )
                    }
                    onEdit={(selectedDiscount) => {
                      setModuleDraft(null);
                      setDiscountDraft(cloneMemberDiscount(selectedDiscount));
                    }}
                  />
                ))}
              </Reorder.Group>
            ) : (
              <div className="mt-5 rounded-[2rem] border border-dashed border-line bg-canvas/35 p-6 text-sm text-stone-300">
                Add the first member discount to populate the homepage offer section.
              </div>
            )}
          </div>
        </div>
      </section>

      {moduleDraft ? (
        <ModuleEditor
          module={moduleDraft}
          saving={savingPanel}
          onClose={() => setModuleDraft(null)}
          onSave={() => void handleSaveModule()}
          onChange={setModuleDraft}
        />
      ) : null}

      {discountDraft ? (
        <MemberDiscountEditor
          discount={discountDraft}
          saving={savingPanel}
          onClose={() => setDiscountDraft(null)}
          onSave={() => void handleSaveDiscount()}
          onChange={setDiscountDraft}
        />
      ) : null}
    </ProtectedRoute>
  );
}
