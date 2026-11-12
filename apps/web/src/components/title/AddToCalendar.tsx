"use client";

import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { lazyControl, useLazySwap, useStandIn } from "@/components/ui/lazy-swap";
import type { TitleCore } from "./core";

// The menu loads when the button is approached or focused (ui/lazy-swap), not with the title's first screen.
const menuModule = lazyControl(() => import("./CalendarMenu"));

export type CalendarButtonLook = { variant: "secondary" | "tertiary"; size: "sm" | "md" | "lg" };

/**
 * "Add to calendar" for what of the title is still to come: a light button with the menu's look until it is reached
 * for, then the menu itself (./CalendarMenu) — Google Calendar, or a file Apple's Calendar, Outlook and the others add.
 */
export function AddToCalendar({ title, variant, size }: { title: TitleCore } & CalendarButtonLook) {
  const t = useTranslations("titlePage");
  const light = useRef<HTMLButtonElement>(null);
  const swap = useLazySwap(menuModule, light);
  const stand = useStandIn(swap);
  const label = t("addToCalendar");
  if (stand.full) return <stand.full.CalendarMenu title={title} variant={variant} size={size} label={label} initialOpen={swap.start.open} focusTrigger={swap.start.focus} />;
  return (
    <Button ref={light} variant={variant} size={size} icon={CalendarPlus} aria-haspopup="menu" aria-expanded={false} {...stand.handlers}>
      {label}
    </Button>
  );
}
