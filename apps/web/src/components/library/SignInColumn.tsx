"use client";

import { useTranslations } from "next-intl";
import { useSignInLinks } from "@/components/shell/GuestGate";
import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { FocusColumn } from "./FocusColumn";

/**
 * A guest on a list that isn't open to everyone, or on an invitation (S10, S32; 8.6): the sign-in as the sign-in pages
 * have it (design-system 9 "Вход") — the question, "Sign in" and "Create account" stacked, back here afterwards
 * (AUTH-02); what happens next is for a screen reader. The page shell stays: the header, the footer, the tab bar.
 */
export function SignInColumn({ reason, next }: { reason: "listOpen" | "invite"; next?: string }) {
  const t = useTranslations("shell.gate");
  const tc = useTranslations("common");
  const hrefs = useSignInLinks(next);
  return (
    <FocusColumn title={t(reason)} about={t(`${reason}Text`)}>
      <Link href={hrefs.signIn} className={buttonClass("primary", "lg", "w-full")}>
        {tc("signIn")}
      </Link>
      <Link href={hrefs.signUp} className={buttonClass("secondary", "lg", "w-full")}>
        {tc("signUp")}
      </Link>
    </FocusColumn>
  );
}
