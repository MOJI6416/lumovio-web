import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { FocusColumn } from "./FocusColumn";

/**
 * A guest on a list that isn't open to everyone, or on an invitation: the sign-in as the sign-in pages
 * have it — the question, "Sign in" and "Create account" stacked, back to `next` afterwards;
 * what happens next is for a screen reader. A server component: the page brings no script for it (bundle
 * budget). The page shell stays: the header, the footer, the tab bar.
 */
export async function SignInColumn({ reason, next }: { reason: "listOpen" | "invite"; next: string }) {
  const t = await getTranslations("shell.gate");
  const tc = await getTranslations("common");
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <FocusColumn title={t(reason)} about={t(`${reason}Text`)}>
      <Link href={`/auth/sign-in${q}`} className={buttonClass("primary", "lg", "w-full")}>
        {tc("signIn")}
      </Link>
      <Link href={`/auth/sign-up${q}`} className={buttonClass("secondary", "lg", "w-full")}>
        {tc("signUp")}
      </Link>
    </FocusColumn>
  );
}
