import { ListVideo } from "lucide-react";
import type { ReactNode } from "react";
import { tmdbImage } from "@/lib/images";

/**
 * One question on the page's own background (S10 for a guest, S32; design-system 9 "Library", as the sign-in pages'
 * "Вход"): a 360 column in the middle of the site's page, under the header — what it is about first (a list's cover),
 * the h1, one line of facts, then the actions stacked at the column's width, the main one on top. No card, no stage,
 * no icon in a circle; an explanation, if any, is for a screen reader. Works in server components.
 */
export function FocusColumn({
  cover,
  title,
  text,
  about,
  children,
}: {
  cover?: ReactNode;
  title: string;
  text?: ReactNode;
  /** What a screen reader hears after the heading (the reason, the consequence). */
  about?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-x flex flex-col items-center pt-6 pb-16 md:pt-16 lg:pt-20">
      <div className="flex w-full max-w-90 flex-col items-center text-center">
        {cover && <div className="mb-6 w-40">{cover}</div>}
        <h1 className="text-balance text-h2 text-text-1">{title}</h1>
        {text && <p className="mt-3 text-balance text-body text-text-2">{text}</p>}
        {about && <p className="sr-only">{about}</p>}
        {children && <div className="mt-8 flex w-full flex-col gap-3">{children}</div>}
      </div>
    </section>
  );
}

/** A list's cover as on its card (7.12): its first four posters 2×2 on --surface-2. Works in server components. */
export function ListCover({ cover }: { cover: (string | null)[] }) {
  const covers = cover.filter((c): c is string => Boolean(c)).slice(0, 4);
  return (
    <div aria-hidden className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-sm bg-surface-2">
      {covers.length === 0 ? (
        <div className="col-span-2 row-span-2 grid place-items-center text-text-3">
          <ListVideo className="size-8" />
        </div>
      ) : (
        [0, 1, 2, 3].map((i) =>
        covers[i] ? (
          // biome-ignore lint/performance/noImgElement: an 80 px poster of TMDB's, as ListCard draws it
          <img key={i} src={tmdbImage(covers[i], "w185") ?? undefined} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div key={i} className="bg-surface-3" />
        ),
        )
      )}
    </div>
  );
}
