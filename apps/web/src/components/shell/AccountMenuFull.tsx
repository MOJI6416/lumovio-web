"use client";

import { ChevronLeft, ChevronRight, DoorOpen, Globe, LogOut, Settings, Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu as DM } from "radix-ui";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { AvatarButton, ProfileAvatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { usePhoneLayout } from "@/components/ui/layers";
import { Menu, MenuCheckboxItem, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { usePortalContainer } from "@/components/ui/portal";
import { toast } from "@/components/ui/Toast";
import { usePathname } from "@/i18n/navigation";
import type { ThemePref } from "@/lib/prefs";
import { useSession } from "../providers/Providers";
import { LanguageField, THEMES, ThemeSwitch, themeKey, useInterfaceLanguage, useThemePref } from "./Preferences";

import { ACCOUNT_TRIGGER_ID, SIGNED_OUT_KEY } from "./AccountMenu";
import { PREFS_TRIGGER_ID } from "./PrefsMenu";

/*
 * A submenu and a segmented row inside a desktop menu are not in ui/Menu yet: these follow its item and panel look
 * (7.8) and SegmentedControl's segments (7.5). A phone gets a sheet with the real SegmentedControl and Select instead.
 */
const ITEM =
  "relative flex min-h-10 cursor-pointer select-none items-center gap-3 rounded-sm px-3 py-2 text-start text-body text-text-1 transition-colors duration-fast ease-fast focus-visible:-outline-offset-3 data-highlighted:bg-surface-3 data-[state=open]:bg-surface-3 in-data-[tv=1]:min-h-12";
const PANEL =
  "z-popover max-h-(--radix-dropdown-menu-content-available-height) min-w-48 overflow-y-auto rounded-md border border-line bg-surface-2 p-1 text-text-1 shadow-float";
const SEGMENT =
  "flex min-w-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full px-2 text-body-s font-semibold text-text-2 transition-colors duration-base ease-base focus-visible:-outline-offset-2 data-highlighted:text-text-1 data-[state=checked]:bg-text-1/14 data-[state=checked]:text-text-1";

/** Theme as a segmented row of menu radio items: ↑/↓ reach it like any item, ←/→ move along it. */
function ThemeSegments() {
  const t = useTranslations("nav");
  const [pref, set] = useThemePref();
  const sideways = (e: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const row = [...(e.currentTarget.parentElement?.children ?? [])] as HTMLElement[];
    const i = row.indexOf(e.currentTarget);
    row[(i + (rtl ? -step : step) + row.length) % row.length]?.focus();
  };
  return (
    <DM.RadioGroup
      value={pref}
      onValueChange={(v) => set(v as ThemePref)}
      aria-label={t("theme")}
      // The segments fill the row inside the border and padding: at SegmentedControl's 32 px they stood 2 px out of it,
      // the chosen one's edge on the row's own.
      className="mx-2 mb-1 grid h-9 grid-cols-3 rounded-full bg-surface-3 p-0.5"
    >
      {THEMES.map((m) => (
        // Choosing keeps the menu open: the page changes behind it, and another theme is one press away.
        <DM.RadioItem key={m} value={m} onSelect={(e) => e.preventDefault()} onKeyDown={sideways} className={SEGMENT}>
          {t(themeKey(m))}
        </DM.RadioItem>
      ))}
    </DM.RadioGroup>
  );
}

const SUB_OFFSET = 4;
const SUB_COLLISION = 16;

/** Language as a submenu: the finished languages, and the current draft (marked) to leave it. */
function LanguageSubmenu() {
  const t = useTranslations("shell");
  const container = usePortalContainer();
  const { locale, options, choose } = useInterfaceLanguage();
  const current = options.find((o) => o.value === locale)?.label;
  // The submenu opens toward the line's end, or toward its start where there is no room — the account and "Language
  // and theme" menus stand at the header's end, so there it opens to the start. The chevron points where it opens
  // (X-51): the room is measured once the menu has taken its place (it is placed a frame or two after it opens), and
  // again when the item is reached, against the menu's own width.
  const trigger = useRef<HTMLDivElement>(null);
  const [toStart, setToStart] = useState(false);
  const measure = () => {
    const el = trigger.current;
    const panel = el?.closest<HTMLElement>("[role=menu]");
    if (!el || !panel) return;
    const r = el.getBoundingClientRect();
    const room = getComputedStyle(el).direction === "rtl" ? r.left : window.innerWidth - r.right;
    setToStart(room < panel.offsetWidth + SUB_OFFSET + SUB_COLLISION);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the menu opens
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(measure);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const Chevron = toStart ? ChevronLeft : ChevronRight;
  return (
    <DM.Sub>
      <DM.SubTrigger ref={trigger} onPointerEnter={measure} onFocus={measure} className={ITEM}>
        <Globe aria-hidden className="size-5 shrink-0 text-text-2" />
        <span className="min-w-0 flex-1">{t("interfaceLanguage")}</span>
        <span className="truncate text-body-s text-text-2">{current}</span>
        <Chevron aria-hidden className="size-4 shrink-0 text-text-2 rtl:-scale-x-100" />
      </DM.SubTrigger>
      <DM.Portal container={container}>
        <DM.SubContent sideOffset={SUB_OFFSET} collisionPadding={SUB_COLLISION} className={PANEL}>
          {options.map((o) => (
            <MenuCheckboxItem key={o.value} checked={o.value === locale} onCheckedChange={() => o.value !== locale && choose(o.value)}>
              <span lang={o.value}>{o.label}</span>
            </MenuCheckboxItem>
          ))}
        </DM.SubContent>
      </DM.Portal>
    </DM.Sub>
  );
}

/** Theme and language inside a menu: segments and a submenu on a desktop, the real controls in a phone's sheet. */
function PrefsItems({ phone }: { phone: boolean }) {
  const t = useTranslations("nav");
  return phone ? (
    <div className="flex flex-col gap-4 px-3 py-2">
      <div className="flex flex-col gap-2">
        <p aria-hidden className="text-body-s font-semibold text-text-1">
          {t("theme")}
        </p>
        <ThemeSwitch className="w-full" />
      </div>
      <LanguageField />
    </div>
  ) : (
    <>
      <MenuLabel>{t("theme")}</MenuLabel>
      <ThemeSegments />
      <LanguageSubmenu />
    </>
  );
}

/**
 * "Language and theme" for a visitor who isn't signed in (SH-07; the footer no longer has them, owner 2026-10-25): the
 * same theme and site language as the account menu, behind a Globe button in the header. ./PrefsMenu draws a light
 * trigger until this module arrives, then hands over (open, if pressed).
 */
export function PrefsMenu({ initialOpen = false, focusTrigger = false }: { initialOpen?: boolean; focusTrigger?: boolean }) {
  const t = useTranslations("shell");
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(initialOpen);
  useEffect(() => {
    if (!focusTrigger) return;
    if (!initialOpen) {
      document.getElementById(PREFS_TRIGGER_ID)?.focus();
      return;
    }
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="menu"] [role^="menuitem"]')?.focus());
    return () => cancelAnimationFrame(id);
  }, [focusTrigger, initialOpen]);
  return (
    <Menu open={open} onOpenChange={setOpen} label={t("prefs")} trigger={<IconButton id={PREFS_TRIGGER_ID} icon={Globe} label={t("prefs")} />}>
      <PrefsItems phone={phone} />
    </Menu>
  );
}

/**
 * The account menu (redesign-2026-11.md 5, audit SH-08): the current profile on top, "Switch profile" (the profile
 * screen, not every profile listed here), settings and sign out — nothing else. Theme, site language and TV mode are
 * this device's settings (Settings → Devices), support is in the settings' navigation, calendar and stats are in the
 * library. On a phone it is a sheet.
 */
/** The full menu; ./AccountMenu draws a light trigger until this module arrives, then hands over (open, if pressed). */
export function AccountMenu({ initialOpen = false, focusTrigger = false }: { initialOpen?: boolean; focusTrigger?: boolean }) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const { me, locale } = useSession();
  const phone = usePhoneLayout();
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const head = useRef<HTMLDivElement>(null);

  // Taking over from the light trigger that had the focus: keep it on the (now real) trigger, or — opened from the
  // keyboard — put it on the first item, as a menu opened from the keyboard does (SH-08).
  useEffect(() => {
    if (!focusTrigger) return;
    if (!initialOpen) {
      document.getElementById(ACCOUNT_TRIGGER_ID)?.focus();
      return;
    }
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="menu"] [role^="menuitem"]')?.focus());
    return () => cancelAnimationFrame(id);
  }, [focusTrigger, initialOpen]);

  // The sheet of a phone opens with the focus on its first item, not on the close button (SH-08). A desktop menu
  // opened from the keyboard does this itself; opened with the mouse it keeps the focus on the panel (no ring).
  useEffect(() => {
    if (!open || !phone) return;
    const id = requestAnimationFrame(() => {
      head.current?.parentElement?.querySelector<HTMLElement>('[role^="menuitem"], a[href], button')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, phone]);

  if (!me) return null;
  const p = me.activeProfile;
  const name = p?.name ?? me.user.name;
  const kids = Boolean(p?.isKids);
  const back = encodeURIComponent(pathname);

  // The auth client (better-auth) loads only for sign-out, not with the header on every page.
  const signOut = async () => {
    try {
      const { authClient } = await import("@/lib/auth-client");
      const res = await authClient.signOut();
      if (res?.error) throw res.error;
    } catch {
      toast.error(te("network"));
      return;
    }
    // A TorrServer password the service worker holds for the player goes with the session.
    navigator.serviceWorker?.controller?.postMessage({ type: "lumovio:forget-credentials" });
    try {
      sessionStorage.setItem(SIGNED_OUT_KEY, "1");
    } catch {
      // Without storage the home page simply doesn't say it.
    }
    window.location.href = locale === "en" ? "/" : `/${locale}`;
  };

  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      label={t("account")}
      trigger={
        // A kids profile says so next to its avatar, always (8.10).
        <AvatarButton
          id={ACCOUNT_TRIGGER_ID}
          avatar={p?.avatar ?? "aurora"}
          name={name}
          before={kids && <Tag>{ts("kidsTag")}</Tag>}
          aria-label={kids ? `${t("account")}: ${name}, ${ts("kidsTag")}` : `${t("account")}: ${name}`}
        />
      }
    >
      <div ref={head} className="flex items-center gap-3 px-3 pt-2 pb-3">
        <ProfileAvatar avatar={p?.avatar ?? "aurora"} name={name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-title text-text-1">{name}</p>
          {/* A kids profile is marked as one; the parent's e-mail isn't shown there (PRF-01). */}
          {kids ? <Tag className="mt-1">{ts("kidsTag")}</Tag> : <p className="truncate text-body-s text-text-2">{me.user.email}</p>}
        </div>
      </div>
      {kids ? (
        <MenuItem icon={DoorOpen} href={`/profiles?next=${back}`}>
          {t("leaveKids")}
        </MenuItem>
      ) : (
        <MenuItem icon={Users} href={`/profiles?next=${back}`}>
          {t("profiles")}
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={Settings} href="/settings">
        {t("settings")}
      </MenuItem>
      {me.user.role === "admin" && !kids && (
        // The admin is another app on this origin (apps/admin at /admin): a full page load, not the site's router.
        <MenuItem icon={Shield} onSelect={() => window.location.assign("/admin")}>
          {t("admin")}
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={LogOut} onSelect={() => void signOut()}>
        {tc("signOut")}
      </MenuItem>
    </Menu>
  );
}
