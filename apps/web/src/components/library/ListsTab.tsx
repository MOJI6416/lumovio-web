"use client";

import type { ListSummary } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ListCard } from "@/components/media/ListCard";
import { QueryState } from "@/components/ui/QueryState";
import { untilComplete } from "@/lib/incomplete";
import { api } from "@/lib/api";
import { ChoicePill } from "./ChoicePill";
import { GridSkeleton } from "./GridSkeleton";
import { ListGrid } from "./ListGrid";
import { NewListTile } from "./NewListTile";
import { readSort, useUrlState } from "./url-state";

const SORTS = ["updated", "title", "size"] as const;
type Sort = (typeof SORTS)[number];

/**
 * "Lists" (S09, LIB-13, LIB-15): the profile's own and shared lists on the collection's grid, "New list" its first
 * card (with following an MDBList list inside its dialog); the sort pill and the count over them. With no lists the
 * grid is that one card — the way to start is where the lists will be. A new list opens at once with a toast.
 */
export function ListsTab() {
  const t = useTranslations("library");
  const tb = useTranslations("browse");
  const locale = useLocale();
  const { params, set } = useUrlState();
  const sort = readSort<Sort>(params, SORTS, "updated");
  const q = useQuery({ queryKey: ["lists"], queryFn: () => api<{ lists: ListSummary[] }>("/api/lists"), refetchInterval: untilComplete });
  const custom = (d: { lists: ListSummary[] }) => d.lists.filter((l) => l.kind === "custom");
  const order = (ls: ListSummary[]) =>
    sort === "title" ? [...ls].sort((a, b) => a.name.localeCompare(b.name, locale)) : sort === "size" ? [...ls].sort((a, b) => b.itemCount - a.itemCount) : ls;

  return (
    <QueryState query={q} loading={<GridSkeleton count={6} shape="square" toolbar />} error={{ title: t("loadError") }}>
      {(d) => {
        const lists = custom(d);
        return (
          <>
            {lists.length > 1 && (
              <div className="mb-6 flex min-h-11 items-center gap-3 sm:min-h-8">
                <ChoicePill<Sort>
                  sort
                  name={tb("sort")}
                  value={sort}
                  onChange={(v) => set({ sort: v === "updated" ? null : v })}
                  options={[
                    { value: "updated", label: t("sortUpdated") },
                    { value: "title", label: t("sortName") },
                    { value: "size", label: t("sortSize") },
                  ]}
                />
                <p className="text-body-s tabular-nums text-text-2">{t("listsCount", { count: lists.length })}</p>
              </div>
            )}
            <ListGrid>
              <NewListTile />
              {order(lists).map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </ListGrid>
          </>
        );
      }}
    </QueryState>
  );
}
