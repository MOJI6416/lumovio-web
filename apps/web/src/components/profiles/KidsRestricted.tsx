import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { BackButton } from "./BackButton";

/**
 * An adult-only page opened from a kids profile (PRF-02, PRF-04): say so plainly and offer the way out —
 * "Switch profile" opens the picker with every profile (PIN or account password), go home, or back.
 */
export async function KidsRestricted({ from }: { from: string }) {
  const t = await getTranslations("profiles");
  const tn = await getTranslations("nav");
  return (
    <EmptyState
      icon={ShieldAlert}
      title={t("kidsRestrictedTitle")}
      text={t("kidsRestrictedText")}
      action={
        <Link href={`/profiles?next=${encodeURIComponent(from)}`} className={buttonClass("primary")}>
          {tn("profiles")}
        </Link>
      }
      secondaryAction={
        <>
          <Link href="/" className={buttonClass("tertiary")}>
            {t("toHome")}
          </Link>
          <BackButton />
        </>
      }
    />
  );
}
