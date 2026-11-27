import type { TitleDetails } from "@lumovio/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { WatchView } from "@/components/player/WatchView";
import { TvEvents } from "@/components/tvui/shell/TvEvents";
import { TvUnavailable } from "@/components/tvui/shell/TvUnavailable";
import { redirect } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";
import { isCode } from "@/lib/address-read";
import { requireTvProfile } from "@/lib/tv-server";

type Params = Promise<{ locale: string; ref: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  const d = isCode(ref) ? await optional(serverApi<TitleDetails>(`/api/catalog/title/${ref}`), null) : null;
  return { robots: { index: false }, ...(d ? { title: d.title } : {}) };
}

/**
 * Watching on a TV: the same player and sources screen as the site — one way to play —
 * with the remote's model of the player (components/player/LumovioPlayer, `useTvNavOptional`) and the shell's
 * navigation for the sources screen.
 */
export default async function TvWatchPage({ params }: { params: Params }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  if (!isCode(ref)) notFound();
  const me = await requireTvProfile();
  if (me === "unavailable") return <TvUnavailable />;
  let details: TitleDetails;
  try {
    details = await serverApi<TitleDetails>(`/api/catalog/title/${ref}`);
  } catch (e) {
    if (e instanceof ApiRequestError && (e.code === "maturity_blocked" || e.code === "title_unavailable")) redirect({ href: `/title/${ref}`, locale });
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
  return (
    <div data-tv-screen="detail" data-tv-main className="stage h-full overflow-hidden bg-stage">
      <WatchView details={details} />
      <TvEvents />
    </div>
  );
}
