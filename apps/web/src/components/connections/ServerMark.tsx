import { Server } from "lucide-react";
import { cn } from "@/components/ui/cn";

/**
 * The server type's mark: the official Jellyfin, Plex and TorrServer logos from /public/brands — trademarks
 * of their owners, credited on the Credits page. Plex's icon carries its own dark square, so it fills the tile; the others
 * sit in it at 24 px. Decorative: the type is always written next to it.
 */
const MARKS: Record<string, { src: string; fill: boolean }> = {
  jellyfin: { src: "/brands/jellyfin.svg", fill: false },
  plex: { src: "/brands/plex.png", fill: true },
  torrserver: { src: "/brands/torrserver.png", fill: false },
};

export function ServerMark({ kind, className }: { kind: string; className?: string }) {
  const m = MARKS[kind];
  if (!m) return <Server aria-hidden className={cn("size-5", className)} />;
  // biome-ignore lint/performance/noImgElement: a small static brand mark, no image optimisation to gain
  return <img src={m.src} alt="" aria-hidden draggable={false} className={cn("shrink-0 select-none", m.fill ? "size-full rounded-sm" : "size-6", className)} />;
}
