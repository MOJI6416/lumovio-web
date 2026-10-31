import type { TitleDetails } from "@lumovio/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { WatchView } from "@/components/player/WatchView";
import { redirect } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

type Params = Promise<{ locale: string; kind: string; id: string }>;

/** The player tab is named after what plays (SH-12). */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { kind, id } = await params;
  const valid = (kind === "movie" || kind === "tv") && /^\d+$/.test(id);
  // Metadata only: the page says itself when the title can't be loaded.
  const d = valid ? await optional(serverApi<TitleDetails>(`/api/catalog/title/${kind}/${id}`), null) : null;
  return { robots: { index: false }, ...(d ? { title: d.title } : {}) };
}

export default async function WatchPage({ params }: { params: Params }) {
  const { locale, kind, id } = await params;
  setRequestLocale(locale);
  if ((kind !== "movie" && kind !== "tv") || !/^\d+$/.test(id)) notFound();
  let details: TitleDetails;
  try {
    details = await serverApi<TitleDetails>(`/api/catalog/title/${kind}/${id}`);
  } catch (e) {
    // Closed to this profile by its age limit, or hidden at a rights holder's request: the title page says so in the site's frame with the way out — "Switch
    // profile", "Home" — instead of a dead end without a header (8.10, PRF-04). The player's code stays as it was.
    if (e instanceof ApiRequestError && (e.code === "maturity_blocked" || e.code === "title_unavailable")) redirect({ href: `/title/${kind}/${id}`, locale });
    // An id TMDB never had (404) or one out of range (400) is an unknown address (SH-02).
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
  return <WatchView details={details} />;
}
