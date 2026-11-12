import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DOCS_DE } from "@/components/legal/docs-de";
import { DOCS_EN } from "@/components/legal/docs-en";
import { DOCS_ES } from "@/components/legal/docs-es";
import { DOCS_FR } from "@/components/legal/docs-fr";
import { DOCS_IT } from "@/components/legal/docs-it";
import { DOCS_PL } from "@/components/legal/docs-pl";
import { DOCS_PT_BR } from "@/components/legal/docs-pt-BR";
import { DOCS_RU } from "@/components/legal/docs-ru";
import { DOCS_TR } from "@/components/legal/docs-tr";
import { DOCS_UK } from "@/components/legal/docs-uk";
import { LEGAL_DOCS, type LegalDoc } from "@/components/legal/parts";
import { buttonClass } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { isInterfaceLocale } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { pageSeo } from "@/lib/seo";

/** When each document last changed (the privacy policy: the Spotify button got its current name). */
const UPDATED: Record<LegalDoc, string> = { terms: "2026-10-24", privacy: "2026-10-25", credits: "2026-10-25", copyright: "2026-10-24" };

/** Translations of the legal pages; every other language reads the English original. */
const TRANSLATED: Partial<Record<string, Record<LegalDoc, () => ReactNode>>> = { ru: DOCS_RU, uk: DOCS_UK, de: DOCS_DE, fr: DOCS_FR, it: DOCS_IT,es: DOCS_ES, "pt-BR": DOCS_PT_BR, pl: DOCS_PL, tr: DOCS_TR };

const isDoc = (doc: string): doc is LegalDoc => (LEGAL_DOCS as readonly string[]).includes(doc);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; doc: string }>;
  searchParams: Promise<{ version?: string }>;
}): Promise<Metadata> {
  const [{ locale, doc }, { version }] = await Promise.all([params, searchParams]);
  const t = await getTranslations("legal");
  if (!isDoc(doc)) return {};
  // The English original shown at a translated address is the same text as /legal/<doc>: not indexed twice.
  const original = Boolean(TRANSLATED[locale]) && version === "en";
  return { title: t(doc), ...pageSeo(locale, `/legal/${doc}`), ...(original ? { robots: { index: false } } : {}) };
}

export default async function LegalPage({ params, searchParams }: { params: Promise<{ locale: string; doc: string }>; searchParams: Promise<{ version?: string }> }) {
  const [{ locale, doc }, { version }] = await Promise.all([params, searchParams]);
  if (!isDoc(doc)) notFound();
  const t = await getTranslations("legal");
  const translation = TRANSLATED[locale];
  // A translated language reads its translation, with the English original one link away (`?version=en`, the site language unchanged).
  const original = Boolean(translation) && version === "en";
  const docs = translation && !original ? translation : DOCS_EN;
  // A draft language reads the English page, so its date is English too — the whole phrase in one language.
  const updated = formatDate(UPDATED[doc], translation || isInterfaceLocale(locale) ? locale : "en", { dateStyle: "long" });
  return (
    // The Tool template for reading: one column at a readable measure, centred on the page, the h1
    // in it (no text left against the start edge with the rest of a wide screen empty).
    <div className="page-x">
      <article className="mx-auto max-w-measure">
        <PageHeader title={t(doc)} description={t("updated", { date: updated ?? UPDATED[doc] })} />
        {translation && (
          <InlineAlert
            className="mb-8 max-w-measure"
            action={
              <Link href={original ? `/legal/${doc}` : `/legal/${doc}?version=en`} className={buttonClass("tertiary", "sm")} hrefLang={original ? locale : "en"}>
                {original ? t("readTranslation") : t("readOriginal")}
              </Link>
            }
          >
            {original ? t("originalNotice") : t("translationNotice")}
          </InlineAlert>
        )}
        {/* The header's own 24/32 to the text: the first block drops its top margin. */}
        <div className="max-w-measure *:first:mt-0" lang={original ? "en" : undefined}>
          {docs[doc]()}
        </div>
      </article>
    </div>
  );
}
