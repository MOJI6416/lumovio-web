import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { legacyAddress, queryOf } from "@/lib/legacy-address";
import { localizedPath } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";

/**
 * An older address the proxy didn't move (the API didn't answer it in time): the page moves it to the code's address
 * itself, with the query — or answers 404 for an id the catalog doesn't know.
 */
export async function moveLegacy(locale: string, path: string, search: Record<string, string | string[] | undefined>, prefix = ""): Promise<never> {
  const legacy = legacyAddress(path);
  if (!legacy) notFound();
  const { codes } = await serverApi<{ codes: Record<string, string> }>(`/api/v2/codes?ids=${encodeURIComponent(legacy.key)}`);
  const code = codes[legacy.key];
  if (!code) notFound();
  permanentRedirect(`${encodeURI(localizedPath(locale, `${prefix}${legacy.to(code)}`))}${queryOf(search)}`);
}
