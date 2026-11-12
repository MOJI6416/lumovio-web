import type { CatalogPage, CatalogRow, Genre, MediaKind } from "@lumovio/contracts";
import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import { Billboard } from "@/components/media/Billboard";
import { cardRow } from "@/components/media/card-data";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { shelfHref, shelfInfo } from "@/components/media/shelf-copy";
import { Top10Card } from "@/components/media/Top10Card";
import { LinkTabPanel, LinkTabs } from "@/components/ui/Tabs";
import { optional } from "@/lib/optional";
import { getMe, serverApi } from "@/lib/server-api";
import { showsAnime } from "@/lib/show-anime";
import { SectionNav } from "./SectionNav";

/**
 * Movies / Series / Anime landing. As the home page: the billboard's
 * art under the transparent header, and the section's name, its switch (phone) and its controls — the genre picker and
 * "All films" — compact over the top of the art, on its scrim, not a solid band above it that takes the first
 * screen; then the section's Top 10 (one per page) and curated and genre shelves of ordinary poster cards, each
 * linking to its grid. Without featured titles there is no art: the name and controls head the page.
 */
export async function SectionLanding({
  kind,
  anime,
  title,
  allLabel,
  base,
  genres,
}: {
  kind: MediaKind;
  anime: boolean;
  title: string;
  allLabel: string;
  base: string;
  genres: Genre[];
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const [data, me] = await Promise.all([serverApi<CatalogPage>(`/api/catalog/section/${kind}${anime ? "?anime=1" : ""}`), optional(getMe(), null)]);
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  // Cards get their titles without the overviews no card shows (media/card-data: a lighter page to download).
  const rows = data.rows.map(cardRow);
  const [popular, ...rest] = rows;
  const heading = (r: CatalogRow) => (r.title ? cap(r.title) : t(r.titleKey as "rows.popular"));
  const featured = data.featured.length > 0;
  const active = anime ? "anime" : kind;

  return (
    // The comparison arm the API built this page in: its shelves' counters carry it (lib/discovery-metrics).
    <div className="contents" data-discovery-variant={data.variant}>
      {/* The stage under the transparent header: the section's name and controls over the top of the billboard's art,
          first in the order, so the keyboard meets them before the slide's actions. */}
      <div data-hero={featured ? "" : undefined} className={clsx(featured && "stage relative isolate -mt-16 bg-stage")}>
        <div className={clsx(featured && "absolute inset-x-0 top-0 z-10 pt-16")}>
          <div className="page-x mx-auto max-w-media pt-2 pb-4 md:pt-4">
            {/* On a phone the catalog is one tab of the bottom bar: its sections are a switch at its top; a
                tablet and a desktop have them in the header. */}
            <LinkTabs
              tabs={[
                { id: "movie", href: "/browse/movie", label: t("nav.movies") },
                { id: "tv", href: "/browse/tv", label: t("nav.series") },
                // Anime only while the profile has it on.
                ...(showsAnime(me) ? [{ id: "anime", href: "/anime", label: t("nav.anime") }] : []),
              ]}
              activeId={active}
              label={t("shell.catalogSections")}
              panelId="catalog-section"
              className="mb-3 md:hidden"
            />
            <SectionNav title={title} base={base} genres={genres} allLabel={allLabel} />
          </div>
        </div>
        {featured && <Billboard items={data.featured} genres={genres} under="section" />}
      </div>
      <LinkTabPanel
        panelId="catalog-section"
        activeId={active}
        className={clsx(
          "relative z-10 mx-auto flex max-w-media flex-col gap-8 md:gap-12",
          // As on the home page: up onto the dark billboard in the dark theme only, an even edge in the light one.
          featured ? "mt-2 art-over:in-data-[theme=dark]:-mt-32 art-over:in-data-[theme=light]:mt-12" : "mt-2 md:mt-4",
        )}
      >
        {popular && (
          <Row title={t("rows.top10Section", { section: title })} note={t("rows.top10SectionNote")} id="top10" kind="top10" min={3}>
            {popular.items.slice(0, 10).map((item, i) => (
              <Top10Card key={item.id} title={item} rank={i + 1} priority={i < 4} />
            ))}
          </Row>
        )}
        {rest.map((row) => (
          <Row key={row.key} id={row.key} min={3} title={heading(row)} href={shelfHref(row.key, row.href)} {...shelfInfo(row.key, (k) => t(k as "rows.topRatedNote"))}>
            {row.items.map((item) => (
              <PosterCard key={item.id} title={item} />
            ))}
          </Row>
        ))}
      </LinkTabPanel>
    </div>
  );
}
