import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FocusCard } from "@/components/shell/FocusCard";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

/**
 * A public profile that isn't there (S33): no such handle, or its owner closed the page — not told apart, so a closed
 * page doesn't say it exists. Said about a profile, not "Page not found"; inside the shell (the header and footer stay).
 */
export default async function PublicProfileNotFound() {
  const t = await getTranslations();
  return (
    <>
      {/* A nested not-found takes no metadata: the tab is named here (SH-12); Next adds noindex to a 404 itself. */}
      <title>{`${t("publicProfile.notFoundTitle")} · ${t("common.appName")}`}</title>
      <FocusCard icon={UserRound} title={t("publicProfile.notFoundTitle")} text={t("publicProfile.notFoundText")}>
        <Link href="/" className={buttonClass("primary")}>
          {t("shell.toHome")}
        </Link>
      </FocusCard>
    </>
  );
}
