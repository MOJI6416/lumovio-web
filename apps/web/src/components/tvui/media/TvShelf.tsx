import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { TvCard } from "./TvCard";
import type { TvShelfData } from "./types";

/*
 * A shelf of the TV shell (design-system 7.13 TV variant): a heading, then one row that is one zone of the remote —
 * ←/→ go card by card, the row slides to keep the focused card and part of the next in view, ↑/↓ go to the shelves
 * around it at the same column or the card last chosen there (tvui/nav/engine). No wrap-around at the ends; a shelf
 * with a whole list ends with "See all".
 */

export function TvShelfFrame({
  id,
  title,
  up,
  children,
  className,
}: {
  id: string;
  title: string;
  /** The zone ↑ goes to (`data-zone-up`), when it isn't the previous shelf. */
  up?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-zone-frame aria-label={title} className={cn("flex flex-col gap-2", className)}>
      <h2 className="ps-(--tv-pad) text-h3 text-text-1">{title}</h2>
      <div data-zone={id} data-zone-up={up} data-zone-scroll="x" className="-my-3 overflow-hidden py-3">
        <div data-zone-track className="flex w-max items-start gap-6 ps-(--tv-pad) pe-(--gutter)">
          {children}
        </div>
      </div>
    </section>
  );
}

export function TvMoreCard({ href, shape }: { href: string; shape: "poster" | "wide" }) {
  const t = useTranslations("tvui");
  return (
    <Link
      prefetch={false}
      href={href}
      data-key="more"
      className={cn(
        "tv-focus flex shrink-0 flex-col items-center justify-center gap-3 rounded-sm bg-surface-2 text-body font-semibold text-text-1 focus:bg-text-1 focus:text-bg",
        shape === "wide" ? "w-72 aspect-video" : "w-38 aspect-2/3",
      )}
    >
      <ArrowRight aria-hidden className="size-8" />
      {t("seeAll")}
    </Link>
  );
}

/** Memoised with its cards: the spotlight above changes with the focus, the shelves don't. */
export const TvShelf = memo(function TvShelf({
  shelf,
  zone,
  initial,
  onMore,
  up,
}: {
  shelf: TvShelfData;
  zone: string;
  initial?: boolean;
  /** A removable shelf's "More" for its card at this place (./CardMore). */
  onMore?: (index: number) => void;
  up?: string;
}) {
  const tr = useTranslations("rows");
  const shape = shelf.shape === "wide" ? "wide" : "poster";
  const top10 = shelf.shape === "top10";
  return (
    <TvShelfFrame id={zone} title={shelf.title} up={up}>
      {shelf.items.map((it, i) => (
        <TvCard
          key={it.title.id}
          title={it.title}
          shape={shape}
          href={it.href}
          label={top10 ? `${tr("top10Rank", { rank: i + 1 })}: ${it.title.title}` : it.label}
          index={i}
          progress={it.progress}
          initial={initial && i === 0}
          rank={top10 ? i + 1 : undefined}
          onMore={onMore}
        />
      ))}
      {shelf.href && <TvMoreCard href={shelf.href} shape={shape} />}
    </TvShelfFrame>
  );
});
