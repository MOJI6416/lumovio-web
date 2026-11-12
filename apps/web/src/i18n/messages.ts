/**
 * A language's messages over the English ones: a key the translation lacks shows in English as a whole phrase,
 * never as a raw key. Shared by the request config and its tests.
 */
export function withEnglish<T extends Record<string, unknown>>(en: T, own: Partial<T>): T {
  const out: Record<string, unknown> = { ...en };
  for (const [k, v] of Object.entries(own)) {
    const base = (en as Record<string, unknown>)[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && base && typeof base === "object"
        ? withEnglish(base as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out as T;
}
