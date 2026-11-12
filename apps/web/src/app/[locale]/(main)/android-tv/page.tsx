import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatSize } from "@/lib/format";
import { pageSeo, SITE_URL } from "@/lib/seo";

/** The newest Android TV release, read at build time (next.config.ts, .github/workflows/tv-app.yml). */
interface TvAppRelease {
  versionName: string;
  apk: string;
  size: number;
  minAndroid: string;
}
const release: TvAppRelease | null = process.env.LUMOVIO_TV_APP ? JSON.parse(process.env.LUMOVIO_TV_APP) : null;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations("tvApp");
  // Canonical and hreflang as the site's other pages: without them its ten languages read as duplicates.
  return { title: t("title"), description: t("description"), ...pageSeo((await params).locale, "/android-tv") };
}

/**
 * Lumovio for Android TV: the APK of the app to download, and how a TV gets it by itself — the
 * short address typed into Downloader, which always gives the newest version. The app offers its own updates later.
 * Linked from the footer, Settings → Devices and the code screen of a TV's Android browser.
 */
export default async function AndroidTvPage() {
  const t = await getTranslations("tvApp");
  const locale = await getLocale();
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const strong = (chunks: ReactNode) => <strong className="font-semibold text-text-1">{chunks}</strong>;
  return (
    <div className="page-x">
      <div className="mx-auto flex max-w-tool flex-col gap-10 pb-16">
        <PageHeader title={t("title")} description={t("description")} />
        <section className="flex flex-col items-start gap-3">
          {release ? (
            <>
              <a href={`/${release.apk}`} download className={buttonClass("primary")}>
                <Download aria-hidden />
                {t("download")}
              </a>
              <p className="text-body-s text-text-2">
                {t("version", { version: release.versionName, size: formatSize(release.size, locale) ?? "", android: release.minAndroid })}
              </p>
            </>
          ) : (
            <p className="text-body text-text-2">{t("notYet")}</p>
          )}
        </section>
        <section aria-labelledby="on-tv" className="flex max-w-measure flex-col gap-3">
          <h2 id="on-tv" className="text-h3 text-text-1">
            {t("onTvTitle")}
          </h2>
          <ol className="flex list-inside list-decimal flex-col gap-2 text-body text-text-2">
            <li>{t("step1")}</li>
            <li>{t.rich("step2", { address: `${host}/apk`, strong })}</li>
            <li>{t("step3")}</li>
            <li>{t("step4")}</li>
          </ol>
        </section>
        <section aria-labelledby="updates" className="flex max-w-measure flex-col gap-2">
          <h2 id="updates" className="text-h3 text-text-1">
            {t("updatesTitle")}
          </h2>
          <p className="text-body text-text-2">{t("updatesText")}</p>
        </section>
        <section aria-labelledby="other-tvs" className="flex max-w-measure flex-col gap-2">
          <h2 id="other-tvs" className="text-h3 text-text-1">
            {t("otherTitle")}
          </h2>
          <p className="text-body text-text-2">{t.rich("otherText", { address: `${host}/tv`, strong })}</p>
        </section>
      </div>
    </div>
  );
}
