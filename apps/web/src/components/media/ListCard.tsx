import type { ListSummary } from "@lumovio/contracts";
import { ListVideo } from "lucide-react";
import { useTranslations } from "next-intl";
import { MediaBadge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import { CardMeta } from "./CardMeta";

/**
 * List card (design-system 7.12): a 2×2 collage of the list's first posters on --surface-2 (the list icon when it is
 * empty), the list's name and "12 titles · Only me" under it — one look for lists in the library and on a profile
 * (X-19). Where it comes from and the person's part in it are kept apart (LIB-13): a followed list carries the source's
 * name as its one badge on the art ("MDBList"), a smart list "Smart" (package F); the line says who sees it for the owner's own lists, the person's role
 * in someone else's ("Editor"); a public profile's page shows the count only (`plain`). The width comes from the grid or shelf around
 * it (a poster card's, ./card-sizes). Works in server components.
 */
export function ListCard({ list: l, href = `/lists/${l.id}`, plain = false }: { list: ListSummary; href?: string; plain?: boolean }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const covers = l.cover.filter(Boolean).slice(0, 4);
  const fact = plain
    ? null
    : l.role === "owner"
      ? l.collaborative
        ? t("collaborative")
        : t(`visibility_${l.visibility}`)
      : t(`role_${l.role}`);
  return (
    <div className="group/card w-full min-w-0">
      <Link href={href} className="group/link block rounded-sm focus-visible:outline-none">
        <div className="relative grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-sm bg-surface-2 ring-line-2 transition-[scale,box-shadow] duration-base ease-base pointer-fine:group-hover/card:scale-[1.04] pointer-fine:group-hover/card:ring-2 group-focus-visible/link:scale-[1.04] group-focus-visible/link:outline-(length:--focus-width) group-focus-visible/link:outline-offset-2 group-focus-visible/link:outline-focus motion-reduce:scale-100!">
          {covers.length === 0 ? (
            <div className="col-span-2 row-span-2 grid place-items-center text-text-3">
              <ListVideo aria-hidden className="size-8" />
            </div>
          ) : (
            [0, 1, 2, 3].map((i) =>
              covers[i] ? (
                <img key={i} src={tmdbImage(covers[i], "w185") ?? undefined} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              ) : (
                <div key={i} className="bg-surface-3" />
              ),
            )
          )}
          {l.source && <MediaBadge className="absolute start-1.5 top-1.5">MDBList</MediaBadge>}
          {l.rules && <MediaBadge className="absolute start-1.5 top-1.5">{t("rulesBadge")}</MediaBadge>}
        </div>
        <CardMeta title={l.name} meta={[tc("titlesCount", { count: l.itemCount }), fact]} wrap />
      </Link>
    </div>
  );
}
