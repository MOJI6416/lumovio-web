import { Scale } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FocusCard } from "@/components/shell/FocusCard";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

/**
 * A title hidden at a rights holder's request (Admin → Catalog): the same for everyone, in the Focus template, with the
 * way out home. Shared by the title page and /watch.
 */
export async function TitleUnavailable() {
  const t = await getTranslations();
  return (
    <FocusCard icon={Scale} title={t("titlePage.unavailableTitle")} text={t("titlePage.unavailableText")}>
      <Link href="/" className={buttonClass("primary")}>
        {t("profiles.toHome")}
      </Link>
    </FocusCard>
  );
}
