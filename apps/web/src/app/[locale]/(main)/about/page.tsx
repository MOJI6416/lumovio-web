import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ServerMark } from "@/components/connections/ServerMark";
import { GuestGateLinks } from "@/components/shell/GuestGate";
import { Link, linkClass } from "@/components/ui/Link";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageSeo } from "@/lib/seo";
import { getMeState } from "@/lib/server-api";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations("about");
  return { title: t("title"), description: t("lead"), ...pageSeo((await params).locale, "/about") };
}

/** The servers Lumovio plays from, with their own sites (opened in a new tab). */
const SERVERS = [
  { kind: "jellyfin", name: "Jellyfin", site: "https://jellyfin.org" },
  { kind: "plex", name: "Plex", site: "https://www.plex.tv" },
  { kind: "torrserver", name: "TorrServer", site: "https://github.com/YouROK/TorrServer" },
] as const;

/**
 * Frames of the product: Sintel (Blender Foundation, CC BY) on a computer and a phone, in the player and on a TV — two
 * rows, each frame as wide as its proportions ask so a row's frames are of one height.
 */
const SHOTS = [
  [
    { src: "/about/title-desktop.webp", w: 1440, h: 800, alt: "shotDesktop" },
    { src: "/about/title-phone.webp", w: 780, h: 1688, alt: "shotPhone" },
  ],
  [
    { src: "/about/player.webp", w: 1440, h: 810, alt: "shotPlayer" },
    { src: "/about/tv.webp", w: 1920, h: 975, alt: "shotTv" },
  ],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex max-w-measure scroll-mt-24 flex-col gap-3">
      <h2 id={`${id}-h`} className="text-h3 text-text-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

const external = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass("action")}>
    {label}
  </a>
);

/**
 * What Lumovio is, for someone who came for the first time — from a search, a link, the guest's welcome or "What is
 * this?" by the servers' marks: what it does, how it differs from a streaming service (it has no video of its own), what
 * is needed to watch, and that it is free. The one page whose explanations are its content. A guest gets the way in at
 * its top and its end.
 */
export default async function AboutPage() {
  const t = await getTranslations("about");
  const tl = await getTranslations("legal");
  const tn = await getTranslations("nav");
  const guest = !(await getMeState());
  const p = (text: string) => <p className="text-body text-text-2">{text}</p>;
  return (
    <div className="page-x">
      <div className="mx-auto flex max-w-tool flex-col gap-12 pb-16">
        <PageHeader
          title={t("title")}
          description={t("lead")}
          actions={guest ? <GuestGateLinks lead="signUp" next="/" /> : undefined}
          className="pb-0 sm:pb-0"
        />
        <div className="flex flex-col gap-3 sm:gap-4">
          {SHOTS.map((row) => (
            <div key={row[0].src} className="flex gap-3 sm:gap-4">
              {row.map((s) => (
                // biome-ignore lint/performance/noImgElement: static frames with their sizes, lazily loaded
                <img
                  key={s.src}
                  src={s.src}
                  width={s.w}
                  height={s.h}
                  alt={t(s.alt)}
                  loading="lazy"
                  decoding="async"
                  style={{ flex: `${s.w / s.h} 1 0%` }}
                  className="h-auto min-w-0 rounded-sm bg-surface-2 ring-1 ring-line"
                />
              ))}
            </div>
          ))}
        </div>
        <Section id="catalog" title={t("catalogTitle")}>
          {p(t("catalogText"))}
        </Section>
        <Section id="history" title={t("historyTitle")}>
          {p(t("historyText"))}
        </Section>
        <Section id="servers" title={t("serversTitle")}>
          {p(t("serversLead"))}
          <ul className="flex flex-col gap-4 py-2">
            {SERVERS.map((s) => (
              <li key={s.kind} className="flex items-start gap-4">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2">
                  <ServerMark kind={s.kind} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-title text-text-1">{s.name}</span>
                  <span className="text-body-s text-text-2">{t(`server_${s.kind}`)}</span>
                  <span className="mt-1">{external(s.site, s.site.replace(/^https:\/\/(www\.)?/, ""))}</span>
                </span>
              </li>
            ))}
          </ul>
          {p(t("serversDirect"))}
          {p(t("serversPlayer"))}
        </Section>
        <Section id="screens" title={t("screensTitle")}>
          {p(t("screensText"))}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link variant="action" arrow href="/android-tv">
              {tn("tvApp")}
            </Link>
            <Link variant="action" arrow href="/link">
              {tn("linkDevice")}
            </Link>
          </div>
        </Section>
        <Section id="video" title={t("videoTitle")}>
          {p(t("videoText"))}
          <Link variant="action" arrow href="/legal/copyright" className="w-fit">
            {tl("copyright")}
          </Link>
        </Section>
        <Section id="free" title={t("freeTitle")}>
          {p(t("freeText"))}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {external("https://github.com/MOJI6416/lumovio-web", "GitHub")}
            <Link variant="action" arrow href="/legal/terms">
              {tl("terms")}
            </Link>
            <Link variant="action" arrow href="/legal/privacy">
              {tl("privacy")}
            </Link>
          </div>
        </Section>
        {guest && (
          <div className="flex flex-wrap gap-3">
            <GuestGateLinks lead="signUp" next="/" />
          </div>
        )}
      </div>
    </div>
  );
}
