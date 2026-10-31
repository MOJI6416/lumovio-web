"use client";

import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";

/**
 * A labelled secondary action of the title hero ("Watchlist", "Rate", "More"): a `secondary` lg Button from a tablet
 * up; on a phone one of a row of three, the icon (24) over a 12 px caption — Button `layout="stacked"` (10.1, X-44).
 */
export const HeroAction = forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant" | "size" | "layout">>(function HeroAction(props, ref) {
  return <Button ref={ref} variant="secondary" size="lg" layout="stacked" {...props} />;
});
