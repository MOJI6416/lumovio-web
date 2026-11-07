"use client";

import type { CatalogPage, CatalogRow, TitleSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { Server } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PosterCard } from "@/components/media/PosterCard";
import { Row } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { OverviewSkeleton } from "./GridSkeleton";
import { onServersQuery } from "./whole-list";

/** Everything here is on a server: the card's "On your server" badge would only repeat it. */
const plain = (t: TitleSummary): TitleSummary => (t.onServer ? { ...t, onServer: false } : t);

/**
 * "On my servers" (S09; the owner's decision of 2026-11-07, design-system 9 "Library"): what plays from the profile's
 * own servers in one press — "Watch now" moved here from the home page and the catalog sections. First what was
 * added lately, then the home page's shelves with only the titles that have a copy (the API's unchanged `?watch=now`:
 * a title once on the page, empty shelves gone, the Top 10 a plain shelf). No servers yet — the way to connect one
 * (an adult's tool: not for a kids profile); servers with nothing on them — said so. That a copy in the index doesn't
 * prove the file plays on this device is for a screen reader (1.2).
 */
export function ServersTab() {
  const t = useTranslations();
  const locale = useLocale();
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const page = useQuery({ queryKey: ["catalog-home", "now", locale], queryFn: () => api<CatalogPage>("/api/catalog/home?watch=now") });
  const recent = useQuery(onServersQuery);

  if (page.isLoading || recent.isLoading) return <OverviewSkeleton />;
  if (page.isError && recent.isError)
    return (
      <ErrorState
        error={page.error}
        title={t("library.loadError")}
        onRetry={() => {
          void page.refetch();
          void recent.refetch();
        }}
        retrying={page.isFetching || recent.isFetching}
      />
    );

  const latest = recent.data?.items ?? [];
  const seen = new Set(latest.map((i) => i.id));
  // A title once on the page: the shelves leave out what "Recently added" already shows.
  const rows = (page.data?.rows ?? [])
    .map((r): CatalogRow => ({ ...r, items: r.items.filter((i) => !seen.has(i.id)) }))
    .filter((r) => r.items.length > 0);
  const servers = page.data?.servers ?? (latest.length > 0 ? 1 : 0);

  if (latest.length === 0 && rows.length === 0) {
    return servers === 0 ? (
      <EmptyState
        icon={Server}
        title={t("title.noServers").replace(/\.$/, "")}
        action={
          !kids && (
            <Link href="/settings/connections" className={buttonClass("primary")}>
              {t("title.connectServer")}
            </Link>
          )
        }
      />
    ) : (
      <EmptyState icon={Server} title={t("library.serversEmpty")} />
    );
  }

  return (
    <div>
      <p className="sr-only">{t("rows.watchNowNote")}</p>
      {/* The shelves run to the screen's edges out of the page gutter; each shelf keeps its own edge (5.3). */}
      <div className="-mx-(--gutter) flex flex-col gap-8 md:gap-12">
        {latest.length > 0 && (
          <Row id="servers-recent" title={t("library.serversRecent")}>
            {latest.map((item) => (
              <PosterCard key={item.id} title={plain(item)} />
            ))}
          </Row>
        )}
        {rows.map((row) => (
          <Row key={row.key} id={`servers-${row.key}`} title={row.title ?? t(row.titleKey as "rows.trending")}>
            {row.items.map((item) => (
              <PosterCard key={item.id} title={plain(item)} />
            ))}
          </Row>
        ))}
      </div>
    </div>
  );
}
