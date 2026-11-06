import { cn } from "@/components/ui/cn";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import type { GenreTile as Tile } from "./search-model";

/**
 * A genre tile of a search without a query (design-system 7.12 "GenreTile", as Apple TV's Browse): a 16:9 picture of
 * a popular film of the genre, its name on the foot on the stage's scrim; it opens the catalog's films of that genre.
 * Without a picture — --surface-2 with the name. Rises and takes the ring like a card.
 */
export function GenreTile({ tile }: { tile: Tile }) {
  const src = tmdbImage(tile.art, "w780");
  return (
    <Link href={tile.href} className="group/link block rounded-md focus-visible:outline-none">
      <span
        className={cn(
          "group/card stage relative block aspect-video overflow-hidden rounded-md bg-surface-2 transition-[scale,box-shadow] duration-base ease-base",
          "pointer-fine:hover:scale-[1.03] group-focus-visible/link:scale-[1.03] group-focus-visible/link:shadow-(--focus-halo) group-focus-visible/link:outline-(length:--focus-width) group-focus-visible/link:outline-offset-2 group-focus-visible/link:outline-focus motion-reduce:scale-100!",
        )}
      >
        {src && <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />}
        <span aria-hidden className="absolute inset-0 bg-linear-to-t from-stage/90 via-stage/30 to-transparent" />
        <span className="absolute inset-x-3 bottom-2.5 truncate text-title text-text-1 md:inset-x-4 md:bottom-3">{tile.name}</span>
      </span>
    </Link>
  );
}
