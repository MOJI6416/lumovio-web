import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";

/**
 * A public profile that isn't there: no such handle, or its owner closed the page — not told apart, so a closed
 * page doesn't say it exists. Said about a profile, not "Page not found"; inside the shell (the header and footer stay).
 */
export default async function PublicProfileNotFound() {
  const t = await getTranslations();
  return (
    <>
      {/* A nested not-found takes no metadata: the tab is named here; Next adds noindex to a 404 itself. */}
      <title>{`${t("publicProfile.notFoundTitle")} · ${t("common.appName")}`}</title>
      <EmptyState
        variant="page"
        icon={UserRound}
        title={t("publicProfile.notFoundTitle")}
        about={t("publicProfile.notFoundText")}
        action={
          <Link href="/" className={buttonClass("primary", "lg")}>
            {t("shell.toHome")}
          </Link>
        }
      />
    </>
  );
}
