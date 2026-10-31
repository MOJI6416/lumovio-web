"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useRef } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { lazyControl, OPEN_KEYS, useLazySwap } from "@/components/ui/lazy-swap";

/** The trigger of the guest's "Language and theme", the same element before and after the full menu arrives. */
export const PREFS_TRIGGER_ID = "prefs-menu-trigger";

const full = lazyControl(() => import("./AccountMenuFull"));

/**
 * The header's "Language and theme" for a visitor who isn't signed in (SH-07): a Globe button, on a desktop and a phone.
 * The menu behind it (Radix menu, theme and language controls) is the account menu's module, so it loads as that one
 * does — when the pointer comes near, the button gets the focus or the browser is idle (bundle budget, ui/lazy-swap).
 */
export function PrefsMenu() {
  const t = useTranslations("shell");
  const light = useRef<HTMLButtonElement>(null);
  const { full: m, start, activate } = useLazySwap(full, light);
  if (m) return <m.PrefsMenu initialOpen={start.open} focusTrigger={start.focus} />;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!OPEN_KEYS.includes(e.key)) return;
    e.preventDefault();
    activate(true);
  };
  return (
    <IconButton
      ref={light}
      id={PREFS_TRIGGER_ID}
      icon={Globe}
      label={t("prefs")}
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={() => activate(false)}
      onFocus={() => activate(false)}
      onPointerDown={(e) => {
        if (e.button === 0) activate(true);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
