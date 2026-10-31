import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FocusCard } from "@/components/shell/FocusCard";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

/**
 * A title closed to this profile by its age limit (design-system 8.10, PRF-04): said plainly in the Focus template
 * with the way out — "Switch profile" (the picker, PIN or password) and "Home". Shared by the title page, /watch and the person page (`person` words it for a person).
 */
export async function MaturityBlocked({ from, person = false }: { from: string; person?: boolean }) {
  const t = await getTranslations();
  const me = await getMeState();
  const kids = me !== "unavailable" && Boolean(me?.activeProfile?.isKids);
  return (
    <FocusCard icon={ShieldAlert} title={person ? t("titlePage.blockedPersonTitle") : kids ? t("titlePage.blockedKidsTitle") : t("title.maturityBlocked")}
      text={kids ? t("titlePage.blockedKidsText") : t("title.maturityBlockedText")}>
      <Link href={`/profiles?next=${encodeURIComponent(from)}`} className={buttonClass("primary")}>
        {t("nav.profiles")}
      </Link>
      <Link href="/" className={buttonClass("secondary")}>
        {t("profiles.toHome")}
      </Link>
    </FocusCard>
  );
}

