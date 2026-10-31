/** Lower case without accents and marks, so "Deutsch" finds "deutsch", "e" finds "é" and "е" finds "ё". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/**
 * The options a Combobox shows for what was typed: every option whose label or keywords (a language's own name,
 * a code) contain the text; those where a word starts with it come first, otherwise the order is kept.
 */
export function filterOptions<T extends { label: string; keywords?: readonly string[] }>(
  options: readonly T[],
  query: string,
): T[] {
  const q = fold(query.trim());
  if (!q) return [...options];
  const first: T[] = [];
  const then: T[] = [];
  for (const o of options) {
    const texts = [o.label, ...(o.keywords ?? [])].map(fold);
    if (texts.some((t) => t.split(/[\s\-–—(),./]+/).some((w) => w.startsWith(q)) || t.startsWith(q))) first.push(o);
    else if (texts.some((t) => t.includes(q))) then.push(o);
  }
  return [...first, ...then];
}
