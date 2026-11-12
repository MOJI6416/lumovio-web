import { Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";

/**
 * A title hidden at a rights holder's request (Admin → Catalog): the same for everyone, the page state — the
 * reason is its one visible line, as it won't come back — with the way out home. Shared by the title page and /watch.
 */
export async function TitleUnavailable() {
  const t = await getTranslations();
  return (
    <EmptyState
      variant="page"
      icon={Scale}
      title={t("titlePage.unavailableTitle")}
      note={t("titlePage.unavailableText")}
      action={
        <Link href="/" className={buttonClass("primary", "lg")}>
          {t("profiles.toHome")}
        </Link>
      }
    />
  );
}
