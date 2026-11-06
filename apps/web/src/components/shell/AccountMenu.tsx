"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useRef } from "react";
import { AvatarButton } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { lazyControl, OPEN_KEYS, useLazySwap } from "@/components/ui/lazy-swap";
import { useSession } from "../providers/Providers";

/** Set before the reload that follows "Sign out"; the header of the next page says it happened (SH-09). */
export const SIGNED_OUT_KEY = "lumovio:signed-out";
/** The trigger of the account menu, the same element before and after the full menu arrives. */
export const ACCOUNT_TRIGGER_ID = "account-menu-trigger";

const full = lazyControl(() => import("./AccountMenuFull"));

/**
 * The header's account button. Every page has it, the menu behind it is opened rarely, so the menu (Radix menu,
 * theme and language controls, sign-out) loads when the pointer comes near the button, it gets the focus or the
 * browser is idle — then ./AccountMenuFull takes its place, open if it was already pressed (bundle budget, as
 * ui/Select). Looks exactly like the real trigger.
 */
export function AccountMenu() {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const { me } = useSession();
  const light = useRef<HTMLButtonElement>(null);
  const { full: m, start, activate } = useLazySwap(full, light);

  if (!me) return null;
  if (m) return <m.AccountMenu initialOpen={start.open} focusTrigger={start.focus} />;

  const p = me.activeProfile;
  const name = p?.name ?? me.user.name;
  const kids = Boolean(p?.isKids);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!OPEN_KEYS.includes(e.key)) return;
    e.preventDefault();
    activate(true);
  };
  return (
    <AvatarButton
      ref={light}
      id={ACCOUNT_TRIGGER_ID}
      avatar={p?.avatar ?? "aurora"}
      photo={p?.photo}
      name={name}
      before={kids && <Tag>{ts("kidsTag")}</Tag>}
      aria-haspopup="menu"
      aria-expanded={false}
      aria-label={kids ? `${t("account")}: ${name}, ${ts("kidsTag")}` : `${t("account")}: ${name}`}
      onPointerEnter={() => activate(false)}
      onFocus={() => activate(false)}
      onPointerDown={(e) => {
        if (e.button === 0) activate(true);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
