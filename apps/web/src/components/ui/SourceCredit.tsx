import type { CommonsPhoto, TextCredit as Credit } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "./cn";

/*
 * A source credit: one quiet line right under a text or a photo whose source's terms ask for its name beside it —
 * Wikipedia (CC BY-SA 4.0), Wikimedia Commons (the author and the licence), Shikimori, Kinopoisk, TheTVDB. Not an
 * explanation: without the line such a text or photo isn't shown. The names and the licence are links to the source's
 * page, in a new tab; on a TV (`tv`) only the words, as nothing there opens a page. No client code of its own.
 */

const LINE = "flex flex-wrap items-center gap-x-1 text-text-2";
/** The line's size: `caption` on the site, `body` on a TV (its smallest readable text from the sofa). */
const size = (tv: boolean) => (tv ? "text-body" : "text-caption");
const LINK = "inline-flex min-h-6 items-center underline-offset-3 hover:underline focus-visible:underline max-sm:min-h-11";

/** Wikipedia's licence for its texts. */
const WIKIPEDIA_LICENSE = { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" };

/** A Creative Commons licence's page by its short name ("CC BY-SA 3.0", "CC0"); null for public domain and others. */
export function licenseUrl(name: string | null): string | null {
  const cc = name ? /^CC (BY(?:-SA)?) (\d\.\d)/i.exec(name) : null;
  if (cc) return `https://creativecommons.org/licenses/${cc[1]!.toLowerCase()}/${cc[2]}/`;
  return name && /^CC0/i.test(name) ? "https://creativecommons.org/publicdomain/zero/1.0/" : null;
}

/** A Wikimedia Commons file: its thumbnail in one of Commons' standard widths, and its page. */
export function commonsFile(path: string) {
  const name = path.split("/").pop() ?? "";
  // SVG and TIFF files are thumbnailed as PNG.
  const png = /\.(svg|tiff?)$/i.test(name) ? ".png" : "";
  return {
    thumb: (width: 250 | 500) => encodeURI(`https://upload.wikimedia.org/wikipedia/commons/thumb${path}/${width}px-${name}${png}`),
    page: encodeURI(`https://commons.wikimedia.org/wiki/File:${name}`),
  };
}

function Out({ href, tv, children }: { href: string | null; tv: boolean; children: ReactNode }) {
  if (!href || tv) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={LINK}>
      {children}
    </a>
  );
}

const Dot = () => <span aria-hidden>·</span>;

/** «Text: Wikipedia · CC BY-SA 4.0», «Text: Shikimori», «Metadata provided by TheTVDB». */
export function TextCredit({ credit, tv = false, className }: { credit: Credit; tv?: boolean; className?: string }) {
  const t = useTranslations("credit");
  if (credit.source === "tvdb") return <TvdbCredit url={credit.url} tv={tv} className={className} />;
  const source = credit.source === "wikipedia" ? t("wikipedia") : credit.source === "kinopoisk" ? t("kinopoisk") : "Shikimori";
  return (
    <p className={cn(LINE, size(tv), className)}>
      <span>
        {t.rich("text", {
          source,
          link: (chunks) => (
            <Out href={credit.url} tv={tv}>
              {chunks}
            </Out>
          ),
        })}
      </span>
      {credit.source === "wikipedia" && (
        <>
          <Dot />
          <Out href={WIKIPEDIA_LICENSE.url} tv={tv}>
            {WIKIPEDIA_LICENSE.name}
          </Out>
        </>
      )}
    </p>
  );
}

/** «Photo: Author · CC BY-SA 3.0 · Wikimedia Commons»: the author links the file's page on Commons. */
export function PhotoCredit({ photo, tv = false, className }: { photo: CommonsPhoto; tv?: boolean; className?: string }) {
  const t = useTranslations("credit");
  const { page } = commonsFile(photo.path);
  return (
    <p className={cn(LINE, size(tv), className)}>
      <span>
        {t.rich("photo", {
          source: photo.author ?? "Wikimedia Commons",
          link: (chunks) => (
            <Out href={page} tv={tv}>
              {chunks}
            </Out>
          ),
        })}
      </span>
      {photo.license && (
        <>
          <Dot />
          <Out href={licenseUrl(photo.license)} tv={tv}>
            {photo.license}
          </Out>
        </>
      )}
      {photo.author && (
        <>
          <Dot />
          <span>Wikimedia Commons</span>
        </>
      )}
    </p>
  );
}

/** «Metadata provided by TheTVDB», TheTVDB linking the title's page there (or its site). */
export function TvdbCredit({ url, tv = false, className }: { url?: string | null; tv?: boolean; className?: string }) {
  const t = useTranslations("credit");
  return (
    <p className={cn(LINE, size(tv), className)}>
      <span>
        {t.rich("tvdb", {
          link: (chunks) => (
            <Out href={url ?? "https://thetvdb.com"} tv={tv}>
              {chunks}
            </Out>
          ),
        })}
      </span>
    </p>
  );
}
