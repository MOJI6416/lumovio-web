"use client";

import type { ListDetails } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/components/ui/Link";
import { catalogHref } from "@/lib/discover-rules";
import { relativeTime } from "@/lib/format";
import { RuleTags } from "./RuleTags";

/**
 * A smart list's conditions on its page (S10, package F; design-system 8.13): the conditions as labels under the
 * heading — they are what the list is — with "All in the catalog" to the grid with the same conditions, and for a
 * catalog list the one fact that changes, when it was last brought up to date (or that it is being filled). How it
 * keeps itself up to date and what happens to titles removed or added by hand is the section's description for a
 * screen reader (1.2: no explanations on screen); a catalog that didn't answer is a warning. "Edit conditions" is the
 * owner's button in the page's heading.
 */
export function RulesNotice({ list: l, isOwner, canEdit }: { list: ListDetails; isOwner: boolean; canEdit: boolean }) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const locale = useLocale();
  const info = l.rules!;
  const r = info.rules;
  const catalog = r.from === "catalog";
  const state = !catalog
    ? null
    : info.status === "pending"
      ? t("rulesFilling")
      : info.status === "ok" && info.checkedAt
        ? t("rulesChecked", { when: relativeTime(info.checkedAt, locale, tr("common.justNow")) })
        : null;
  const about = [
    catalog ? t("rulesTitleCatalog") : t("rulesTitleLibrary"),
    !catalog && (isOwner ? t("rulesLibraryLive") : t("rulesLibraryLiveReader")),
    catalog && t("rulesLimitLine", { limit: info.limit ?? 100 }),
    canEdit && t("rulesManual"),
    isOwner && (r.onServers || r.unwatched) && t("rulesPersonalHint"),
  ].filter(Boolean);
  return (
    <section aria-label={t("rulesConditions")} className="mb-6 flex flex-col gap-3">
      <p className="sr-only">{about.join(" ")}</p>
      {catalog && info.status === "unavailable" && <InlineAlert tone="warning" title={t("rulesUnavailable")} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <RuleTags rules={r} label={t("rulesConditions")} />
        {catalog && (
          // A 44 px target on a phone, 32+ on a computer (5.6): the line stays as it is.
          <Link variant="action" arrow href={catalogHref(r.query)} className="-my-1.5 max-sm:-my-3.5">
            {t("rulesViewAll")}
          </Link>
        )}
      </div>
      {state && (
        <p className="text-body-s text-text-2" role="status">
          {state}
        </p>
      )}
    </section>
  );
}
