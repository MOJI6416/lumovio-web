"use client";

import { Info } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { IconButton } from "./IconButton";
import { lazyControl, useLazySwap, useStandIn } from "./lazy-swap";

const full = lazyControl(() => import("./InfoTipPopover"));

export interface InfoTipContent {
  /** What the shelf or section is, in plain words. */
  note?: string;
  /** How it was picked, where its data comes from, legal lines. */
  rules?: string;
  /** A way to change it ("Adjust" for "For you"). */
  link?: ReactNode;
}

/**
 * The "i" next to a heading: what a shelf or section is, how it was picked and where its
 * data comes from, in a Popover (a sheet on a phone) — not grey lines under the heading. `label` names
 * the button ("How it's picked: Top 10", "About “Ratings”"), `title` heads the popover. One component for shelves
 * (once; the headings have none) and sections (sources/InfoTip). The popover (Radix and its positioning)
 * loads when the button is approached, focused or the browser is idle (./lazy-swap, bundle budget); on a TV
 * the button takes the remote's size itself (IconButton).
 */
export function InfoTip({ title, label, ...content }: InfoTipContent & { title: string; label: string }) {
  const light = useRef<HTMLButtonElement>(null);
  const swap = useLazySwap(full, light);
  const part = useStandIn(swap);
  if (part.full)
    return <part.full.InfoTipPopover title={title} label={label} {...content} initialOpen={swap.start.open} focusTrigger={swap.start.focus} />;
  return <IconButton ref={light} icon={Info} size="sm" label={label} aria-haspopup="dialog" aria-expanded={false} {...part.handlers} />;
}
