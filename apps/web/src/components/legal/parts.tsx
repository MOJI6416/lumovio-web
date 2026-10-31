import { LUMOVIO_SCORE_VERSION } from "@lumovio/contracts";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { linkClass } from "@/components/ui/Link";

/** The building blocks of a legal page's text (Tool template, 9): a section heading, a paragraph, a list, an outside link. */
export function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-h2 text-text-1">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-text-1">{children}</p>;
}

export function L({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 ps-6 text-text-1">
      {items.map((x, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static text
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={linkClass()} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/**
 * TMDB's logo over its notice on "Credits" — the attribution TMDB's terms ask for (the logo and "This product uses the
 * TMDB API but is not endorsed or certified by TMDB"); since 2026-10-25 it lives here only, not in the footer.
 */
export function TmdbMark() {
  return (
    <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xs">
      <img src="/brands/tmdb.svg" alt="The Movie Database (TMDB)" className="h-12 w-auto" />
    </a>
  );
}

export type LegalDoc = "terms" | "privacy" | "credits" | "copyright";
export const LEGAL_DOCS: readonly LegalDoc[] = ["terms", "privacy", "credits", "copyright"];
export const LEGAL_CONTACT = "legal@lumovio.app";

/**
 * The Lumovio Score's methodology (the link from a title's "How it's calculated" lands here), in the language of the text
 * around it: the English original shows it in English, a translation in the page's language.
 */
export async function ScoreMethodology({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "score.method" });
  return (
    <section id="lumovio-score" className="scroll-mt-24">
      <H>{t("title")}</H>
      <P>{t("what")}</P>
      <P>{t("scale")}</P>
      <P>{t("weights")}</P>
      <P>{t("shown")}</P>
      <P>{t("terms")}</P>
      <P>{t("derived", { version: LUMOVIO_SCORE_VERSION })}</P>
    </section>
  );
}
