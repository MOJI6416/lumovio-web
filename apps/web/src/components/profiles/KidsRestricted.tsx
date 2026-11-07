import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";

/**
 * An adult-only page opened from a kids profile (PRF-02, PRF-04, 8.10; 7.11, under the page's own header): say so — the
 * limit is the one visible line a state keeps — and offer the way out in the account menu's words: "Leave the kids
 * profile" opens "Who's watching?" with every profile (PIN, the account password or a mailed code) and comes back
 * here; "Home" beside it. Back is the browser's (or, in the installed app, the header's).
 */
export async function KidsRestricted({ from }: { from: string }) {
  const t = await getTranslations("profiles");
  const tn = await getTranslations("nav");
  return (
    <EmptyState
      icon={ShieldAlert}
      title={t("kidsRestrictedTitle")}
      note={t("kidsRestrictedText")}
      action={
        <Link href={`/profiles?next=${encodeURIComponent(from)}`} className={buttonClass("primary", "lg")}>
          {tn("leaveKids")}
        </Link>
      }
      secondaryAction={
        <Link href="/" className={buttonClass("tertiary", "lg")}>
          {t("toHome")}
        </Link>
      }
    />
  );
}
