import type { MediaKind } from "@lumovio/contracts";

/** URL-friendly slug that keeps non-Latin scripts readable (Cyrillic, CJK…). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip accents from Latin letters only (é → e); Cyrillic й/ё keep their marks.
    .replace(/([a-zA-Z])[\u0300-\u036f]+/g, "$1")
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function titleHref(kind: MediaKind, tmdbId: number, title?: string | null): string {
  const slug = title ? slugify(title) : "";
  return `/title/${kind}/${tmdbId}${slug ? `-${slug}` : ""}`;
}

/**
 * A person's address is the id alone: their name is spelled differently by language (Latin on TMDB, localized here), and
 * one address per person keeps every link and the canonical the same. Older addresses with
 * a name redirect to it.
 */
export function personHref(id: number, _name?: string): string {
  return `/person/${id}`;
}

export function parseSlugId(slug: string): number | null {
  const m = /^(\d+)/.exec(decodeURIComponent(slug));
  return m ? Number(m[1]) : null;
}
