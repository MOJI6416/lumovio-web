"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { usePersonalActions } from "@/components/media/usePersonalActions";
import { ActionMark } from "@/components/ui/BrandMotion";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Popover } from "@/components/ui/Popover";
import { api } from "@/lib/api";
import type { TitleCore } from "./core";
import { HeroAction } from "./HeroAction";

/**
 * "Rate" (design-system 8.1, TTL-22): a popover (a sheet on a phone) with 1–10 — a press saves it at once and the
 * button shows "★ 8"; "Remove rating" in the same popover takes it back. ←/→ move between the values. Loaded by
 * TitleActions when it is approached. The number changes at once; the star fills when the server has saved it (6.3.1).
 */
export function TitleRate({
  title: d,
  actions,
  initialOpen,
  focusTrigger,
  label,
}: {
  title: TitleCore;
  actions: ReturnType<typeof usePersonalActions>;
  initialOpen: boolean;
  focusTrigger: boolean;
  label: string;
}) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  const values = useRef<(HTMLButtonElement | null)[]>([]);
  const rating = actions.state?.rating ?? null;
  const saving = actions.busy === "rate";
  // Each confirmed rating plays the star's fill once (a new key).
  const [confirmed, setConfirmed] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);
  // The popover opens on the current rating (or 1), not on its edge.
  useEffect(() => {
    if (open) requestAnimationFrame(() => values.current[(rating ?? 1) - 1]?.focus());
  }, [open, rating]);

  const save = async (value: number | null) => {
    setOpen(false);
    const r = await actions.mutate({ key: "rate", run: () => api("/api/library/rating", { method: "PUT", json: { titleId: d.id, value } }), optimistic: { rating: value } });
    if (r?.ok && value !== null) setConfirmed((n) => n + 1);
  };
  const onKey = (e: KeyboardEvent, v: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 5 : e.key === "ArrowUp" ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(10, Math.max(1, v + (rtl && Math.abs(step) === 1 ? -step : step)));
    values.current[next - 1]?.focus();
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      title={t("rateTitle", { title: d.title })}
      showTitle
      align="start"
      trigger={
        <HeroAction ref={trigger} aria-label={label}>
          {rating && confirmed && !saving ? (
            <ActionMark key={confirmed} kind="rating" drawn className="text-current" />
          ) : (
            <Star aria-hidden className={cn(rating && !saving && "fill-current")} />
          )}
          {rating ?? t("rate")}
        </HeroAction>
      }
    >
      <div role="radiogroup" aria-label={t("rateTitle", { title: d.title })} className="grid grid-cols-5 gap-2">
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
      <p className="mt-3 text-body-s text-text-2">{rating ? t("ratedNote", { value: rating }) : t("rateNote")}</p>
      {rating !== null && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => void save(null)}>
          {tt("clearRating")}
        </Button>
      )}
    </Popover>
  );
}
