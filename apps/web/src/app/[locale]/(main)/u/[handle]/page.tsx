import type { ListSummary, TitleSummary } from "@lumovio/contracts";
import { CloudOff, Star, UserRound } from "lucide-react";
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
import { getPathname, Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { pageSeo } from "@/lib/seo";
import { getMeState, serverApi } from "@/lib/server-api";
import { ShareProfile } from "./ShareProfile";

interface PublicProfile {
  handle: string;
  name: string;
  avatar: string;
  photo: string | null;
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

/**
 * A public profile (S33; design-system 9 «Публичный профиль»): who it is the way a person page says it — the circle and the
 * name side by side, the handle over the name, their own words — then what the owner opted into: favourites, ratings
 * (the highest first: what they loved is what a visitor came for) and public lists. "Share" for anyone, "Edit" for
 * the owner. Never history, progress or servers.
 */
export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await load(handle);
  if (!p) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  if (p === "unavailable") {
    // Said on the page with Retry — not an endless wait or a generic crash (X-14). Retry reloads the page.
    const again = getPathname({ href: `/u/${encodeURIComponent(handle)}`, locale });
    return (
      <ErrorState
        variant="page"
        icon={CloudOff}
        title={t("errors.unavailableTitle")}
        about={t("errors.loadText")}
        details={null}
        action={
          <a href={again} className={buttonClass("primary", "lg")}>
            {t("common.retry")}
          </a>
        }
      />
    );
  }
  // The owner looking at their own page (signed in, that profile chosen): "Edit" leads to where it is set up.
  // A guest or an account the API can't answer for is simply not the owner: the page stays the visitor's.
  const me = await getMeState();
  const own = me !== null && me !== "unavailable" && me.activeProfile?.handle?.toLowerCase() === p.handle.toLowerCase();
  const ratings = [...p.ratings].sort((a, b) => b.value - a.value);
  const url = getPathname({ href: `/u/${encodeURIComponent(p.handle)}`, locale });
  const empty = p.favorites.length + p.ratings.length + p.lists.length === 0;

  return (
    <div className="flex flex-col gap-10 pt-6 sm:pt-8 md:gap-12">
      {/* As a person page (9, Person): the circle and the name side by side, 112 / 160 / 192; their words and the buttons
          under both on a phone, beside the circle from md. */}
      <header className="page-x mx-auto grid w-full max-w-media grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-5 [--avatar:7rem] md:grid-cols-[10rem_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:items-start md:gap-x-8 md:[--avatar:10rem] xl:grid-cols-[12rem_minmax(0,1fr)] xl:gap-x-10 xl:[--avatar:12rem]">
        <ProfileAvatar avatar={p.avatar} photo={p.photo} name={p.name} size="var(--avatar)" className="md:row-span-2" />
        <div className="min-w-0 md:pt-4">
          <p className="text-body-s font-semibold text-text-2 wrap-anywhere">@{p.handle}</p>
          <h1 className="mt-1 text-balance text-h1 text-text-1">{p.name}</h1>
        </div>
        <div className="col-span-2 mt-4 flex min-w-0 flex-col gap-4 md:col-span-1 md:col-start-2 md:mt-2">
          {p.bio && <p className="max-w-measure text-body text-text-1 md:text-body-l">{p.bio}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <ShareProfile title={`${p.name} (@${p.handle})`} url={url} />
            {own && (
              <Link href="/settings/profile" className={buttonClass("tertiary")}>
                {t("common.edit")}
              </Link>
            )}
          </div>
        </div>
      </header>
      {p.favorites.length > 0 && (
        <Row title={t("library.favorites")} id="pub-fav">
          {p.favorites.map((f) => (
            <PosterCard key={f.id} title={f} showState={false} />
          ))}
        </Row>
      )}
      {ratings.length > 0 && (
        // Their rating is the card's line, with the star of a rating (7.14): "★ 9"; said as "Rating: 9".
        <Row title={t("library.ratings")} id="pub-ratings">
          {ratings.map((r) => (
            <PosterCard
              key={r.title.id}
              title={r.title}
              showState={false}
              fact={t("publicProfile.rating", { value: r.value })}
              factShown={
                <span className="inline-flex items-center gap-1 text-text-1">
                  <Star aria-hidden className="size-3.5 fill-current" />
                  {r.value}
                </span>
              }
            />
          ))}
        </Row>
      )}
      {p.lists.length > 0 && (
        <section className="page-x mx-auto w-full max-w-media" aria-labelledby="pub-lists">
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
      {empty && (
        // Nothing shared yet is said in words (LIB-21); the owner is told what can go here ("Edit" is in the header).
        <EmptyState icon={UserRound} title={t("publicProfile.empty")} about={own ? t("publicProfile.emptyOwner") : undefined} />
      )}
    </div>
  );
}
