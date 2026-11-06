"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef } from "react";
import type { usePersonalActions } from "@/components/media/usePersonalActions";
import { Button } from "@/components/ui/Button";
import { Dialog, Sheet } from "@/components/ui/Dialog";
import { usePhoneLayout } from "@/components/ui/layers";
import { api } from "@/lib/api";
import type { TitleCore } from "./core";

/**
 * "Rate" (design-system 8.1, TTL-22; redesign-2026-11.md 2: an item of the hero's "More"): a small dialog (a sheet on a
 * phone) with 1–10 — a press saves it at once; "Remove rating" in the same dialog takes it back. ←/→ move between the
 * values. TitleActions loads it when it is opened.
 */
export function TitleRate({
  title: d,
  actions,
  open,
  onOpenChange,
}: {
  title: TitleCore;
  actions: ReturnType<typeof usePersonalActions>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const phone = usePhoneLayout();
  const values = useRef<(HTMLButtonElement | null)[]>([]);
  const rating = actions.state?.rating ?? null;
  // It opens on the current rating (or 1), not on its edge.
  useEffect(() => {
    if (open) requestAnimationFrame(() => values.current[(rating ?? 1) - 1]?.focus());
  }, [open, rating]);

  const save = async (value: number | null) => {
    onOpenChange(false);
    await actions.mutate({ key: "rate", run: () => api("/api/library/rating", { method: "PUT", json: { titleId: d.id, value } }), optimistic: { rating: value } });
  };
  const onKey = (e: KeyboardEvent, v: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 5 : e.key === "ArrowUp" ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(10, Math.max(1, v + (rtl && Math.abs(step) === 1 ? -step : step)));
    values.current[next - 1]?.focus();
  };

  const title = t("rateTitle", { title: d.title });
  const body = (
    <>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <Button
            key={v}
            ref={(el) => {
              values.current[v - 1] = el;
            }}
            role="radio"
            aria-checked={rating === v}
            tabIndex={v === (rating ?? 1) ? 0 : -1}
            // The chosen value is the one filled button; the rest are plain (one main element, 1.2).
            variant={rating === v ? "primary" : "secondary"}
            onClick={() => void save(v)}
            onKeyDown={(e) => onKey(e, v)}
            className="tabular-nums"
          >
            {v}
          </Button>
        ))}
      </div>
      {rating !== null && (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => void save(null)}>
          {tt("clearRating")}
        </Button>
      )}
    </>
  );
  return phone ? (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {body}
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="sm">
      {body}
    </Dialog>
  );
}
