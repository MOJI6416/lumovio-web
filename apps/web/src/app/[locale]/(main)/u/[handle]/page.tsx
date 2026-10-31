import type { ListSummary, TitleSummary } from "@lumovio/contracts";
import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ListGrid } from "@/components/library/ListGrid";
import { ListCard } from "@/components/media/ListCard";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPathname } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { pageSeo } from "@/lib/seo";
import { serverApi } from "@/lib/server-api";

interface PublicProfile {
  handle: string;
  name: string;
  avatar: string;
  bio: string | null;
  favorites: TitleSummary[];
  ratings: { title: TitleSummary; value: number }[];
  lists: ListSummary[];
}

/** `null` — no such public profile; `"unavailable"` — the API could not answer (network, timeout, 5xx). */
async function load(handle: string): Promise<PublicProfile | null | "unavailable"> {
  try {
    return await serverApi<PublicProfile>(`/api/public/${encodeURIComponent(handle)}`);
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    return "unavailable";
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; handle: string }> }): Promise<Metadata> {
  const { locale, handle } = await params;
  const p = await load(handle);
  // Canonical and hreflang at the handle as the owner spells it (SH-13).
  return p && p !== "unavailable"
    ? { title: `${p.name} (@${p.handle})`, description: p.bio ?? undefined, ...pageSeo(locale, `/u/${encodeURIComponent(p.handle)}`) }
    : {};
}

/** A public page shows only what the owner opted into — never history, progress or servers. */
export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await load(handle);
  if (!p) notFound();
  const t = await getTranslations();
  if (p === "unavailable") {
    // Said on the page with Retry — not an endless wait or a generic crash (X-14). Retry reloads the page.
    const again = getPathname({ href: `/u/${encodeURIComponent(handle)}`, locale: await getLocale() });
    return (
      <div className="page-x">
        <div className="mx-auto max-w-tool">
          <PageHeader title={`@${handle}`} />
          <ErrorState
            title={t("errors.serverTitle")}
            text={t("errors.serverText")}
            action={
              <a href={again} className={buttonClass("secondary")}>
                {t("common.retry")}
              </a>
            }
          />
        </div>
      </div>
    );
  }
  return (
    // The page gutter (5.3, X-02): the header and the lists on it; the shelves keep their own edge.
    <div className="mx-auto max-w-media">
      <header className="page-x flex items-center gap-5 pt-6 sm:pt-8">
        <ProfileAvatar avatar={p.avatar} name={p.name} size={88} />
        <div className="min-w-0 max-w-tool">
          <h1 className="text-balance text-h1 text-text-1">{p.name}</h1>
          <p className="text-text-2">@{p.handle}</p>
          {p.bio && <p className="mt-2 max-w-measure text-body text-text-1">{p.bio}</p>}
        </div>
      </header>
      <div className="mt-8 flex flex-col gap-12">
        {p.favorites.length > 0 && (
          <Row title={t("library.favorites")} id="pub-fav">
            {p.favorites.map((f) => (
              <PosterCard key={f.id} title={f} showState={false} />
            ))}
          </Row>
        )}
        {p.ratings.length > 0 && (
          // The rating is the card's line, not a plate over the poster (LIB-12, LIB-22).
          <Row title={t("library.ratings")} id="pub-ratings">
            {p.ratings.map((r) => (
              <PosterCard key={r.title.id} title={r.title} showState={false} subtitle={t("library.theirRating", { value: r.value })} />
            ))}
          </Row>
        )}
        {p.lists.length > 0 && (
          <section className="page-x" aria-labelledby="pub-lists">
            <h2 id="pub-lists" className="mb-3 text-h2 text-text-1 md:mb-4">
              {t("library.lists")}
            </h2>
            <ListGrid>
              {p.lists.map((l) => (
                <ListCard key={l.id} list={l} plain />
              ))}
            </ListGrid>
          </section>
        )}
        {p.favorites.length + p.ratings.length + p.lists.length === 0 && (
          // Nothing shared yet is said in words, not "♡ —" (LIB-21).
          <EmptyState icon={UserRound} title={t("library.publicEmpty", { name: p.name })} text={t("library.publicEmptyText")} />
        )}
      </div>
    </div>
  );
}
