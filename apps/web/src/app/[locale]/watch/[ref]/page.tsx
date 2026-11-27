import type { TitleDetails } from "@lumovio/contracts";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { WatchView } from "@/components/player/WatchView";
import { redirect } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { queryOf } from "@/lib/legacy-address";
import { optional } from "@/lib/optional";
import { localizedPath } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";
import { isCode } from "@/lib/address-read";
import { watchHref } from "@/lib/slug";

type Params = Promise<{ locale: string; ref: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** The player tab is named after what plays. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  // Metadata only: the page says itself when the title can't be loaded.
  const d = isCode(ref) ? await optional(serverApi<TitleDetails>(`/api/catalog/title/${ref}`), null) : null;
  return { robots: { index: false }, ...(d ? { title: d.title } : {}) };
}

export default async function WatchPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  if (!isCode(ref)) notFound();
  let details: TitleDetails;
  try {
    details = await serverApi<TitleDetails>(`/api/catalog/title/${ref}`);
  } catch (e) {
    // Closed to this profile by its age limit, or hidden at a rights holder's request: the title page says so in the site's frame with the way out — "Switch
    // profile", "Home" — instead of a dead end without a header. The player's code stays as it was.
    if (e instanceof ApiRequestError && (e.code === "maturity_blocked" || e.code === "title_unavailable")) redirect({ href: `/title/${ref}`, locale });
    // A code never issued is an unknown address.
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
  // A code merged into another title plays under that one's, with the same query.
  if (details.code && details.code !== ref) permanentRedirect(`${localizedPath(locale, watchHref(details))}${queryOf(await searchParams)}`);
  return <WatchView details={details} />;
}

