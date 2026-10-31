import { Compass, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FocusCard } from "@/components/shell/FocusCard";
import { Shell } from "@/components/shell/Shell";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

/**
 * The branded 404 for any unknown address (SH-01, 8.5), in the visitor's language, inside the shell (SH-02): the
 * header and footer stay, the page is the Focus template.
 */
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <Shell overlay>
      {/* A nested not-found takes no metadata: the tab is named here (SH-12); Next adds noindex to a 404 itself. */}
      <title>{`${t("errors.notFoundTitle")} · ${t("common.appName")}`}</title>
      <FocusCard icon={Compass} title={t("errors.notFoundTitle")} text={t("errors.notFoundText")}>
        <Link href="/" className={buttonClass("primary")}>
          {t("shell.toHome")}
        </Link>
        <Link href="/search" className={buttonClass("secondary")}>
          <Search aria-hidden />
          {t("common.search")}
        </Link>
      </FocusCard>
    </Shell>
  );
}
