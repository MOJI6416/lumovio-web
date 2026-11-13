import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import "../globals.css";
import { LaunchHost } from "@/components/player/launch";
import { Providers } from "@/components/providers/Providers";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { ThemeScript } from "@/components/shell/ThemeScript";
import { DragScroll } from "@/components/ui/DragScroll";
import { localeInfo } from "@/i18n/locales";
import { BRAND_LIME, OG_IMAGE } from "@/lib/brand";
import { APPLE_STARTUP_IMAGES } from "@/lib/brand-startup.gen";
import { ogLocale, SITE_URL } from "@/lib/seo";
import { routing } from "@/i18n/routing";
import { getMeState } from "@/lib/server-api";
import { TV_SHELL_HEADER } from "@/lib/tv";

// Every interface language is Latin or Cyrillic: latin-ext carries the letters of pl, tr, de, fr,
// es, it and pt-BR (ł ş ğ ı İ ä ß œ ç ã…). CJK names in the data fall back to the system fonts of --font-sans.
const ui = Onest({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-ui",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(SITE_URL),
    // The tagline names the home page; the description says in a sentence what Lumovio is (a search result's snippet).
    title: { default: `${t("appName")} — ${t("tagline")}`, template: `%s · ${t("appName")}` },
    description: t("description"),
    applicationName: "Lumovio",
    // The manifest in the page's language: app/manifest.ts for English, app/[locale]/manifest.webmanifest else.
    manifest: locale === "en" ? "/manifest.webmanifest" : `/${locale}/manifest.webmanifest`,
    // og:locale as language_TERRITORY; public pages add their canonical and og:url (lib/seo.ts).
    openGraph: { siteName: "Lumovio", type: "website", ...ogLocale(locale), images: [OG_IMAGE] },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, title: "Lumovio", statusBarStyle: "black-translucent", startupImage: APPLE_STARTUP_IMAGES },
    // Next writes the standard `mobile-web-app-capable`; iOS has read startup images only with its own name.
    other: { "apple-mobile-web-app-capable": "yes" },
    formatDetection: { telephone: false },
  };
}

/**
 * The browser chrome follows the chosen theme, not the OS: the --bg of that theme (globals.css). Discord draws
 * a shared link's stripe in the same colour — its crawler gets the logo's lime instead of the near-black page.
 */
export async function generateViewport(): Promise<Viewport> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  const pref = c.get("lumovio_theme")?.value;
  const dark = "#0a0a0b"; // ui-lint-ignore hex-color: theme-color meta = --bg (dark)
  const light = "#f5f5f7"; // ui-lint-ignore hex-color: theme-color meta = --bg (light)
  return {
    themeColor: /Discordbot/i.test(h.get("user-agent") ?? "")
      ? BRAND_LIME
      : pref === "light"
        ? light
        : pref === "system"
          ? [
              { media: "(prefers-color-scheme: dark)", color: dark },
              { media: "(prefers-color-scheme: light)", color: light },
            ]
          : dark,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, meState, c, h] = await Promise.all([getMessages(), getMeState(), cookies(), headers()]);
  // Every page carries the client's messages in its HTML; the design-system showcase's (a tenth of the catalogue) only
  // its own page does (dev/ui), so the others download and parse less before they respond.
  const { devUi: _showcase, ...clientMessages } = messages;
  // The API not answering is not "signed out": the header then offers no sign-in either.
  const me = meState === "unavailable" ? null : meState;
  const info = localeInfo(locale);
  const themePref = c.get("lumovio_theme")?.value ?? "dark";
  // The TV shell (app/[locale]/tvui) is chosen by the proxy for this device (lib/tv.ts); the site is never "TV mode".
  const tv = h.get(TV_SHELL_HEADER) === "tv";
  // The page's nonce (proxy.ts, Content-Security-Policy): Next's own scripts carry it by themselves, this one is ours.
  const nonce = h.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      dir={info.dir}
      data-theme={themePref === "light" ? "light" : "dark"}
      data-tv={tv ? "1" : undefined}
      className={ui.variable}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <Providers me={me} apiDown={meState === "unavailable"} locale={locale} tv={tv}>
            {children}
            <ThemeSync />
            <DragScroll />
            {/* The launch of a viewing: one scene from "Watch" to the first frame, over the pages it passes. */}
            <LaunchHost />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
