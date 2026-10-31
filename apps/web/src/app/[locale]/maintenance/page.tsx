import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/shell/Wordmark";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "maintenance" });
  return { title: t("title"), robots: { index: false } };
}

/** What every page shows while the owner has maintenance on (Admin → Management → Settings); the admin keeps working. */
export default async function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  // The proxy rewrote the address here before the language was set: it comes from the address itself.
  const t = await getTranslations({ locale: (await params).locale, namespace: "maintenance" });
  return (
    <main id="main" className="page-x grid min-h-dvh place-items-center py-16">
      <div className="max-w-measure space-y-4 text-center">
        <Wordmark className="mx-auto" />
        <h1 className="text-h1 text-text-1">{t("title")}</h1>
        <p className="text-body text-text-2">{t("text")}</p>
      </div>
    </main>
  );
}
