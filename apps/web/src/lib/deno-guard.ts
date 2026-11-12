/**
 * Better Auth reads its environment when its module loads, as `globalThis.process?.env || globalThis.Deno?.env.toObject()
 * || …`: a browser with a `Deno` global but no `Deno.env` (a crawler's — 486 render errors on the sign-in pages)
 * threw there, and every page that loads the auth client showed "Something went wrong". Imported before
 * Better Auth (auth-client.ts); a page has no use for such a `Deno`.
 */
const g = globalThis as { Deno?: { env?: { toObject?: unknown } } };
if (g.Deno && typeof g.Deno.env?.toObject !== "function") {
  try {
    g.Deno = undefined;
  } catch {
    // A read-only global stays; Better Auth then fails as before.
  }
}

export {};
