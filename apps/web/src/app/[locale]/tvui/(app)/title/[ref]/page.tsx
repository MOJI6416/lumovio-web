import type { TitleDetails } from "@lumovio/contracts";
import { Lock, Scale, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { collectionName, titleCore } from "@/components/title/core";
import { TvBackButton } from "@/components/tvui/shell/TvBackButton";
import { TvState } from "@/components/tvui/shell/TvState";
import { PendingDetails } from "@/components/ui/PendingDetails";
import { TitleScreen } from "@/components/tvui/title/TitleScreen";
import { TextCredit } from "@/components/ui/SourceCredit";
import { trimOverview } from "@/components/tvui/media/types";
import { ApiRequestError } from "@/lib/api";
import { formatRuntime } from "@/lib/format";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";
import { parseCodeSlug } from "@/lib/address-read";

type Params = Promise<{ locale: string; ref: string }>;

async function load(ref: string): Promise<TitleDetails | "blocked" | "unavailable" | null> {
  const code = parseCodeSlug(ref);
  if (!code) return null;
  try {
    return await serverApi<TitleDetails>(`/api/catalog/title/${code}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.code === "maturity_blocked") return "blocked";
    if (e instanceof ApiRequestError && e.code === "title_unavailable") return "unavailable";
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { ref } = await params;
  const d = await optional(load(ref), null);
  return { robots: { index: false }, ...(d && typeof d !== "string" ? { title: d.title } : {}) };
}

/** A title on a TV: the same details as the site's title page. */
export default async function TvTitlePage({ params }: { params: Params }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const d = await load(ref);
  if (d === null || typeof d === "string") {
    const state =
      d === "blocked"
        ? { icon: Lock, title: t("title.maturityBlocked"), text: t("title.maturityBlockedText") }
        : d === "unavailable"
          ? { icon: Scale, title: t("titlePage.unavailableTitle"), text: t("titlePage.unavailableText") }
          : { icon: SearchX, title: t("errors.notFoundTitle"), text: undefined };
    return (
      <div data-tv-screen="detail" className="flex h-full flex-col justify-center gap-10 ps-(--tv-pad) pe-(--gutter)">
        <TvState icon={state.icon} title={state.title} text={state.text}>
          <TvBackButton initial />
        </TvState>
      </div>
    );
  }
  const core = titleCore(d, locale.slice(0, 2));
  const shown = new Set([d.id]);
  const parts = d.collection?.parts.filter((p) => p.id !== d.id) ?? [];
  for (const p of parts) shown.add(p.id);
  // The film series first, then what is like it — each title once.
  const related = [...parts, ...d.related.filter((p) => !shown.has(p.id)), ...d.relatedOther.filter((p) => !shown.has(p.id))].slice(0, 20).map(trimOverview);
  const runtime = formatRuntime(d.runtime, (k, v) => t(k as "common.minutes", v));
  const kindLabel = d.isAnime ? t("common.anime") : d.kind === "movie" ? t("common.movie") : t("common.series");
  const facts = [
    kindLabel,
    d.year ? String(d.year) : null,
    runtime,
    d.kind === "tv" && d.numberOfSeasons ? t("common.seasons", { count: d.numberOfSeasons }) : null,
    ...d.genres.slice(0, 3).map((g) => g.name.charAt(0).toLocaleUpperCase(locale) + g.name.slice(1)),
    d.certification,
    d.collection && parts.length ? collectionName(d.collection.name) : null,
  ].filter((x): x is string => Boolean(x));
  // The screen gets what it shows: the first of the cast, not the whole credits, videos and recommendations again.
  const slim: TitleDetails = { ...d, cast: d.cast.slice(0, 20), crew: [], creators: [], related: [], relatedOther: [], videos: [], keywords: [], collection: null };
  return (
    <>
      <TitleScreen details={slim} core={core} related={related} facts={facts} credit={d.overviewCredit ? <TextCredit credit={d.overviewCredit} tv /> : null} />
      {/* The catalog is loading the rest: the screen asks again by itself. */}
      {d.pending && <PendingDetails quiet />}
    </>
  );
}
