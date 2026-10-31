import { clsx } from "clsx";
import { Film, Tv } from "lucide-react";
import { posterSrcSet, tmdbImage } from "@/lib/images";

/**
 * A poster image for rows (history, calendar). Without artwork — the placeholder of 6.5: --surface-2 with the type's
 * icon, never "no image" text or the title squeezed into a 40 px box (LIB-23). `title` is the image's alt; leave it
 * empty where the name stands next to it.
 */
export function Poster({
  path,
  title,
  kind = "movie",
  sizes = "(min-width: 1280px) 200px, (min-width: 768px) 160px, 40vw",
  priority,
  className,
}: {
  path: string | null;
  title: string;
  kind?: "movie" | "tv";
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!path) {
    const Icon = kind === "tv" ? Tv : Film;
    return (
      <div {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })} className={clsx("grid aspect-2/3 w-full place-items-center bg-surface-2 text-text-3", className)}>
        <Icon aria-hidden className="size-1/3 max-h-8 max-w-8" />
      </div>
    );
  }
  return (
    <img
      src={tmdbImage(path, "w342") ?? undefined}
      srcSet={posterSrcSet(path)}
      sizes={sizes}
      alt={title}
      width={342}
      height={513}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={clsx("aspect-2/3 w-full bg-surface-2 object-cover", className)}
    />
  );
}
