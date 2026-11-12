import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell/Shell";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";

/**
 * The branded 404 for any unknown address, in the visitor's language, inside the shell: the
 * header and footer stay, the page state — "Page not found" and "Home"; search is in the header.
 */
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <Shell>
      {/* A nested not-found takes no metadata: the tab is named here; Next adds noindex to a 404 itself. */}
      <title>{`${t("errors.notFoundTitle")} · ${t("common.appName")}`}</title>
      <EmptyState
        variant="page"
        icon={Compass}
        title={t("errors.notFoundTitle")}
        about={t("errors.notFoundText")}
        action={
          <Link href="/" className={buttonClass("primary", "lg")}>
            {t("shell.toHome")}
          </Link>
        }
      />
    </Shell>
  );
}
