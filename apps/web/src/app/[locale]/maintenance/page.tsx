import { RefreshCw } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/shell/Wordmark";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "maintenance" });
  return { title: t("title"), robots: { index: false } };
}

/**
 * What every page shows while the owner has maintenance on (Admin → Management → Settings); the admin keeps working.
 * The page state of 7.11 under the logo where the header has it (as the offline page): what is going on, "Retry" that
 * opens the same address again, "back in a few minutes" for a screen reader.
 */
export default async function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  // The proxy rewrote the address here before the language was set: it comes from the address itself.
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance" });
  const tc = await getTranslations({ locale, namespace: "common" });
  return (
    <>
      <header className="page-x flex h-16 items-center">
        <Wordmark />
      </header>
      <main id="main">
        <EmptyState
          variant="page"
          title={t("title")}
          about={t("text")}
          action={
            // The address in the bar is the page that was asked for (the proxy rewrote it here): "?" opens it again —
            // a link, so the page brings no script.
            <a href="?" className={buttonClass("primary", "lg")}>
              <RefreshCw aria-hidden />
              {tc("retry")}
            </a>
          }
        />
      </main>
    </>
  );
}
