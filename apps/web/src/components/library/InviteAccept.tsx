"use client";

import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/**
 * "Join" and "Not now" of an invitation (S32), stacked at the column's width, the main one on top. Joining opens the
 * list with a toast; a link that stopped working meanwhile, or a refusal, is said in words (LIB-19).
 */
export function InviteAccept({ token }: { token: string }) {
  const t = useTranslations("library");
  const router = useRouter();
  const join = useAction({
    run: () => api<{ listId: string }>(`/api/invites/${token}/accept`, { method: "POST" }),
    success: () => t("joined"),
    error: (e) =>
      e instanceof ApiRequestError && e.code === "not_found" ? t("inviteInvalid") : e instanceof ApiRequestError && e.code === "forbidden" ? t("inviteKidsText") : t("joinFailed"),
  });
  return (
    <>
      <Button
        size="lg"
        className="w-full"
        loading={join.pending}
        onClick={async () => {
          const r = await join.run();
          if (r.ok) router.push(`/lists/${r.value.listId}`);
        }}
      >
        {t("join")}
      </Button>
      <Link href="/library?tab=lists" className={buttonClass("secondary", "lg", "w-full")}>
        {t("notNow")}
      </Link>
    </>
  );
}
