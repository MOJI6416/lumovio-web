"use client";

import type { ConnectionSummary, Me } from "@lumovio/contracts";
import { CircleAlert, CircleCheck, Globe, Keyboard, LogOut, Monitor, Palette, Plus, Smartphone, UserRound, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { TvButton } from "@/components/ui/tv/TvButton";
import { INTERFACE_LOCALES } from "@/i18n/locales";
import { authClient } from "@/lib/auth-client";
import { getThemePref, setTheme, type ThemePref } from "@/lib/prefs";
import { localizedPath } from "@/lib/seo";
import { TV_COOKIE } from "@/lib/tv";
import { TvLayer } from "../nav/TvLayer";
import { TvScroll } from "../nav/TvScroll";
import { ChoiceLayer } from "../shell/ChoiceLayer";
import { ContinueOnPhone } from "../shell/ContinueOnPhone";

type Open = "phone" | "lang" | "theme" | "mode" | "keys" | null;

/*
 * Settings on a TV (S14 TV; TV document §4 "Настройки/подключения", §7.2): what a TV may change itself — the profile,
 * this TV's language, theme and shell — and a short status of the servers; everything that is set up (servers, account,
 * profiles, import) continues on a phone with a QR code. "About this TV" says what the TV is (for checking a new one,
 * TV document §10 step 0) and "Remote check" shows the codes of the keys pressed.
 */
export function SettingsScreen({ me, servers, appVersion }: { me: Me; servers: ConnectionSummary[] | null; appVersion: string | null }) {
  const t = useTranslations("tvui");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState<Open>(null);
  const [phone, setPhone] = useState<{ path: string; title: string } | null>(null);
  const [theme, setThemeState] = useState<ThemePref>("dark");
  useEffect(() => {
    setThemeState(getThemePref());
    setMode(new RegExp(`(?:^|; )${TV_COOKIE}=1`).test(document.cookie) ? "tv" : "auto");
  }, []);
  const profile = me.activeProfile!;
  const [mode, setMode] = useState<"auto" | "tv">("auto");
  const onPhone = (path: string, title: string) => {
    setPhone({ path, title });
    setOpen("phone");
  };

  const row = (icon: ReactNode, label: string, value: string | null, onClick: () => void, key: string) => (
    <TvButton look="row" data-key={key} onClick={onClick}>
      {icon}
      <span className="flex-1">{label}</span>
      {value && <span className="max-w-120 truncate opacity-75">{value}</span>}
    </TvButton>
  );

  return (
    <div data-tv-screen="section" className="relative h-full">
      <TvScroll className="h-full" contentClassName="flex max-w-240 flex-col gap-10 ps-(--tv-pad) pe-(--gutter) pt-12 pb-24">
        <h1 data-zone-frame="top" className="text-h1 text-text-1">
          {tn("settings")}
        </h1>
        <Section title={t("setProfile")}>
          <div data-zone="profile" data-zone-axis="y" className="flex flex-col gap-3">
            <TvButton look="row" data-key="profile" data-tv-initial onClick={() => window.location.assign(`${locale === "en" ? "" : `/${locale}`}/profiles?switch=1`)}>
              <ProfileAvatar avatar={profile.avatar} name={profile.name} size="2.25rem" />
              <span className="flex-1">{profile.name}</span>
              <span className="opacity-75">{tn("profiles")}</span>
            </TvButton>
            {!profile.isKids && row(<Users aria-hidden />, tn("manageProfiles"), null, () => onPhone("/profiles?manage=1", tn("manageProfiles")), "manage")}
          </div>
        </Section>

        <Section title={t("setThisTv")}>
          <div data-zone="device" data-zone-axis="y" className="flex flex-col gap-3">
            {row(<Globe aria-hidden />, t("setLanguage"), INTERFACE_LOCALES.find((l) => l.code === locale)?.name ?? locale, () => setOpen("lang"), "lang")}
            {row(<Palette aria-hidden />, tn("theme"), theme === "light" ? tn("themeLight") : theme === "system" ? tn("themeSystem") : tn("themeDark"), () => setOpen("theme"), "theme")}
            {row(<Monitor aria-hidden />, t("setMode"), mode === "tv" ? t("modeTv") : t("modeAuto"), () => setOpen("mode"), "mode")}
            {row(<Keyboard aria-hidden />, t("setKeys"), null, () => setOpen("keys"), "keys")}
          </div>
        </Section>

        {servers && !profile.isKids && (
          <Section title={tn("connections")}>
            <div data-zone="servers" data-zone-axis="y" className="flex flex-col gap-3">
              {servers.length === 0 && <p className="text-body-l text-text-2">{t("noServers")}</p>}
              {servers.map((s) => (
                <TvButton key={s.id} look="row" data-key={s.id} onClick={() => onPhone(`/settings/connections?server=${s.id}`, s.name)}>
                  <span className="grid size-9 shrink-0 place-items-center">
                    <ServerMark kind={s.kind} />
                  </span>
                  <span className="flex-1">{s.name}</span>
                  <span className="flex items-center gap-2 opacity-75">
                    {s.status === "ok" ? <CircleCheck aria-hidden className="text-success" /> : <CircleAlert aria-hidden className="text-warning" />}
                    {s.status === "ok" ? t("serverOk") : s.status === "unknown" ? t("serverUnknown") : t("serverProblem")}
                  </span>
                </TvButton>
              ))}
              {row(<Plus aria-hidden />, t("addServer"), null, () => onPhone("/settings/connections", t("addServer")), "add")}
            </div>
          </Section>
        )}

        <Section title={t("setAccount")}>
          <div data-zone="account" data-zone-axis="y" className="flex flex-col gap-3">
            {!profile.isKids && row(<UserRound aria-hidden />, t("manageAccount"), me.user.email || null, () => onPhone("/settings/account", t("manageAccount")), "account")}
            {!profile.isKids && row(<Smartphone aria-hidden />, t("phoneRemote"), null, () => onPhone("/remote", t("phoneRemote")), "remote")}
            {row(<LogOut aria-hidden />, t("signOutTv"), null, () => void authClient.signOut().then(() => window.location.assign(`${locale === "en" ? "" : `/${locale}`}/tv`)), "signout")}
          </div>
        </Section>

        <Section title={t("setAbout")}>
          <About appVersion={appVersion} />
        </Section>
      </TvScroll>

      {open === "phone" && phone && (
        <TvLayer look="dialog" className="max-w-240" label={phone.title} onClose={() => setOpen(null)}>
          {() => <ContinueOnPhone path={phone.path} title={phone.title} />}
        </TvLayer>
      )}
      {open === "lang" && (
        <ChoiceLayer
          title={t("setLanguage")}
          options={INTERFACE_LOCALES.map((l) => ({ value: l.code, label: l.name }))}
          value={locale}
          onClose={() => setOpen(null)}
          onPick={(code) => {
            document.cookie = `lumovio_locale=${code}; path=/; max-age=31536000; samesite=lax`;
            window.location.assign(localizedPath(code, "/settings"));
          }}
        />
      )}
      {open === "theme" && (
        <ChoiceLayer
          title={tn("theme")}
          options={[
            { value: "dark", label: tn("themeDark") },
            { value: "light", label: tn("themeLight") },
            { value: "system", label: tn("themeSystem") },
          ]}
          value={theme}
          onClose={() => setOpen(null)}
          onPick={(v) => {
            setTheme(v as ThemePref);
            setThemeState(v as ThemePref);
          }}
        />
      )}
      {open === "mode" && (
        <ChoiceLayer
          title={t("setMode")}
          options={[
            { value: "auto", label: t("modeAuto") },
            { value: "tv", label: t("modeTv") },
            { value: "site", label: t("modeSite") },
          ]}
          value={mode}
          onClose={() => setOpen(null)}
          onPick={(v) => {
            // The choice belongs to this device only (TV document §4.1): a cookie of this browser.
            document.cookie = v === "auto" ? `${TV_COOKIE}=; path=/; max-age=0; samesite=lax` : `${TV_COOKIE}=${v === "tv" ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
            window.location.assign(localizedPath(locale, v === "site" ? "/" : "/settings"));
          }}
        />
      )}
      {open === "keys" && <KeysLayer onClose={() => setOpen(null)} label={t("setKeys")} close={tc("close")} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-zone-frame aria-label={title} className="flex flex-col gap-4">
      <h2 className="text-h3 text-text-2">{title}</h2>
      {children}
    </section>
  );
}

/** What this TV is: the facts a check of a new TV needs (TV document §10 step 0), nothing to press. */
function About({ appVersion }: { appVersion: string | null }) {
  const t = useTranslations("tvui");
  const [facts, setFacts] = useState<[string, string][]>([]);
  useEffect(() => {
    const sw = "serviceWorker" in navigator ? (navigator.serviceWorker.controller ? t("yes") : t("swNotActive")) : t("no");
    setFacts([
      [t("aboutWindow"), `${window.innerWidth} × ${window.innerHeight} · DPR ${window.devicePixelRatio}`],
      [t("aboutBrowser"), navigator.userAgent],
      [t("aboutApp"), appVersion ?? t("aboutNoApp")],
      [t("aboutWorker"), sw],
      [t("aboutMse"), typeof MediaSource !== "undefined" ? t("yes") : t("no")],
    ]);
  }, [appVersion, t]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-body text-text-2">
      {facts.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-3">{k}</dt>
          <dd className="break-all text-text-1">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The remote check: every key the page receives, with its name and code — so a new TV shows at once whether its
 * arrows, OK and Back reach the page (TV document §2, §10 step 0). Back closes it as any layer, and is listed too.
 */
function KeysLayer({ onClose, label, close: closeLabel }: { onClose: () => void; label: string; close: string }) {
  const t = useTranslations("tvui");
  const [keys, setKeys] = useState<string[]>([]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => setKeys((k) => [`${e.key || "?"} · ${e.code || "—"} · ${e.keyCode}${e.repeat ? " · repeat" : ""}`, ...k].slice(0, 8));
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, []);
  return (
    <TvLayer look="dialog" label={label} onClose={onClose}>
      {(close) => (
        <>
          <h2 className="text-h2 text-text-1">{label}</h2>
          <p className="text-body-l text-text-2">{t("keysText")}</p>
          <ol className="flex min-h-80 flex-col gap-2 text-body-l text-text-1 tabular-nums">
            {keys.map((k, i) => (
              <li key={`${k}${keys.length - i}`} className={i === 0 ? "font-semibold" : "text-text-2"}>
                {k}
              </li>
            ))}
          </ol>
          <div data-zone="keys-close" data-zone-axis="x">
            <TvButton data-tv-initial onClick={close}>
              {closeLabel}
            </TvButton>
          </div>
        </>
      )}
    </TvLayer>
  );
}
