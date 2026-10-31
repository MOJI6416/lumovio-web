import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { isInterfaceLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { webManifest } from "@/lib/web-manifest";

/*
 * /<locale>/manifest.webmanifest (L10N-10): the PWA manifest in the site's language — the locale layout links it, so a
 * page in Russian installs with the Russian description and starts at /ru. A draft language's interface is English,
 * so is its manifest (lang "en"), starting at its own address. Built once per language.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const lang = isInterfaceLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: lang, namespace: "common" });
  return new Response(JSON.stringify(webManifest({ lang, locale, description: t("tagline") })), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
