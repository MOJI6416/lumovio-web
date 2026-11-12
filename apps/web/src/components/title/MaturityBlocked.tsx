import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

/**
 * A title closed to this profile by its age limit: said plainly in the page state
 * — the limit is its one visible line — with the way out: "Switch profile" — "Leave the kids profile" in a kids one (the picker, PIN or password) — and "Home". Shared by the title page, /watch and the person page (`person` words it for a person).
 */
export async function MaturityBlocked({ from, person = false }: { from: string; person?: boolean }) {
  const t = await getTranslations();
  const me = await getMeState();
  const kids = me !== "unavailable" && Boolean(me?.activeProfile?.isKids);
  return (
    <EmptyState
      variant="page"
      icon={ShieldAlert}
      title={person ? t("titlePage.blockedPersonTitle") : kids ? t("titlePage.blockedKidsTitle") : t("title.maturityBlocked")}
      note={kids ? t("titlePage.blockedKidsText") : t("title.maturityBlockedText")}
      action={
        <Link href={`/profiles?next=${encodeURIComponent(from)}`} className={buttonClass("primary", "lg")}>
          {/* A kids profile leaves in the account menu's words, as "Not available in a kids profile" does; an adult one switches. */}
          {kids ? t("nav.leaveKids") : t("nav.profiles")}
        </Link>
      }
      secondaryAction={
        <Link href="/" className={buttonClass("tertiary", "lg")}>
          {t("profiles.toHome")}
        </Link>
      }
    />
  );
}

