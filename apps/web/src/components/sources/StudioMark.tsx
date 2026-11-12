import { cn } from "@/components/ui/cn";

/**
 * Voice-over studios' own marks from /public/brands/studios: each studio's site icon or the avatar of its official
 * channel, unchanged, scaled to one square file — trademarks of their owners, credited on the Credits page. Shown as a
 * circle, as the studios show them; decorative, since the studio's name is always written next to it. Only the studios
 * releases credit most often have one.
 */
const MARKS: Record<string, string> = {
  lostfilm: "lostfilm",
  "hdrezka studio": "hdrezka",
  "red head sound": "redheadsound",
  jaskier: "jaskier",
  alexfilm: "alexfilm",
  coldfilm: "coldfilm",
  amedia: "amedia",
  "кубик в кубе": "kubik",
  "le-production": "leproduction",
  newcomers: "newcomers",
  rudub: "rudub",
  "amazing dubbing": "amazingdubbing",
  "dragon money studio": "dragonmoney",
  "flarrow films": "flarrow",
  viruseproject: "viruseproject",
  goltfilm: "goltfilm",
  "force media": "forcemedia",
  linefilm: "linefilm",
  anilibria: "anilibria",
  anidub: "anidub",
  "shiza project": "shiza",
  "studio band": "studioband",
  "dream cast": "dreamcast",
  animaunt: "animaunt",
  aniplague: "aniplague",
  amanogawa: "amanogawa",
  "цікава ідея": "cikavaideya",
  postmodern: "postmodern",
};

const fileOf = (studio: string | null | undefined) => (studio ? MARKS[studio.trim().toLowerCase()] : undefined);

/** Whether a studio has a mark: a list shows a place for one only when some of its rows have it. */
export const hasStudioMark = (studio: string | null | undefined) => fileOf(studio) !== undefined;

/** The studio's mark (24 px unless `className` says otherwise), or nothing for a studio without one. */
export function StudioMark({ studio, className }: { studio: string | null | undefined; className?: string }) {
  const file = fileOf(studio);
  if (!file) return null;
  return (
    // biome-ignore lint/performance/noImgElement: a small static brand mark, no image optimisation to gain
    <img
      src={`/brands/studios/${file}.webp`}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={cn("size-6 shrink-0 select-none rounded-full bg-surface-2 object-cover", className)}
    />
  );
}

/** A row's mark in a list where some rows have one: the mark, or an empty place of its size, so the names line up. */
export function StudioSlot({ studio, className }: { studio: string | null | undefined; className?: string }) {
  return hasStudioMark(studio) ? <StudioMark studio={studio} className={className} /> : <span aria-hidden className={cn("size-6 shrink-0", className)} />;
}
