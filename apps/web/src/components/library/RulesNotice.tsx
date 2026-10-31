"use client";

import type { ListDetails } from "@lumovio/contracts";
import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/components/ui/Link";
import { useRouter } from "@/i18n/navigation";
import { catalogHref } from "@/lib/discover-rules";
import { relativeTime } from "@/lib/format";
import { RuleTags } from "./RuleTags";
import { rulesHref } from "./rules-url";

/**
 * A smart list's page (S10, package F): one banner that explains it — its conditions as labels, when it was last brought
 * up to date (a catalog list: once a day, the first 100 titles, with "All in the catalog" to the grid with the same
 * conditions) or that it follows the library at once, what happens to titles removed and added by hand, and for the
 * owner "Edit conditions" (the catalog or the library with these conditions, saved back into this list). Someone else
 * sees the conditions without the owner's personal ones and without "Edit conditions".
 */
export function RulesNotice({ list: l, isOwner, canEdit }: { list: ListDetails; isOwner: boolean; canEdit: boolean }) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const info = l.rules!;
  const r = info.rules;
  const catalog = r.from === "catalog";
  const state = !catalog
    ? isOwner
      ? t("rulesLibraryLive")
      : t("rulesLibraryLiveReader")
    : info.status === "pending"
      ? t("rulesFilling")
      : info.status === "unavailable"
        ? t("rulesUnavailable")
        : info.checkedAt
          ? t("rulesChecked", { when: relativeTime(info.checkedAt, locale, tr("common.justNow")) })
          : null;
  return (
    <InlineAlert
      tone={catalog && info.status === "unavailable" ? "warning" : "info"}
      className="mb-6"
      title={catalog ? t("rulesTitleCatalog") : t("rulesTitleLibrary")}
      action={
        isOwner && (
          <Button variant="tertiary" size="sm" icon={SlidersHorizontal} onClick={() => router.push(rulesHref(r, l.id))}>
            {t("rulesEdit")}
          </Button>
        )
      }
    >
      <RuleTags rules={r} label={t("rulesConditions")} className="my-2" />
      <span className="block">
        {[state, catalog && t("rulesLimitLine", { limit: info.limit ?? 100 })].filter(Boolean).join(" ")}
        {catalog && (
          <>
            {" "}
            {/* A 44 px target on a phone, 32+ on a computer (5.6), as the followed list's link: the line stays as it is. */}
            <Link href={catalogHref(r.query)} className="-my-3.5 inline-flex py-3.5 md:-my-2 md:py-2">
              {t("rulesViewAll")}
            </Link>
          </>
        )}
      </span>
      {(canEdit || (isOwner && (r.onServers || r.unwatched))) && (
        <span className="block">
          {[canEdit && t("rulesManual"), isOwner && (r.onServers || r.unwatched) && t("rulesPersonalHint")].filter(Boolean).join(" ")}
        </span>
      )}
    </InlineAlert>
  );
}
