"use client";

import type { ListSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListVideo, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ListCard } from "@/components/media/ListCard";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QueryState } from "@/components/ui/QueryState";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { untilComplete } from "@/lib/incomplete";
import { ConnectListDialog } from "./ConnectListDialog";
import { CreateListDialog } from "./CreateListDialog";
import { GridSkeleton } from "./GridSkeleton";
import { ListGrid } from "./ListGrid";
import { readSort, useUrlState } from "./url-state";

const SORTS = ["updated", "title", "size"] as const;
type Sort = (typeof SORTS)[number];

/**
 * "Lists" (S09, LIB-13, LIB-15): the person's own and shared lists as ListCards, sorted; one "New list" — in the toolbar,
 * or as the empty state's action — and following an MDBList list as a link inside its dialog. A new list opens at once
 * with a toast.
 */
export function ListsTab() {
  const t = useTranslations("library");
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const { me } = useSession();
  const { params, set } = useUrlState();
  const sort = readSort<Sort>(params, SORTS, "updated");
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const q = useQuery({ queryKey: ["lists"], queryFn: () => api<{ lists: ListSummary[] }>("/api/lists"), refetchInterval: untilComplete });
  // Following an external list needs MDBList on the server and isn't offered to kids profiles.
  const sources = useQuery({ queryKey: ["list-sources"], queryFn: () => api<{ mdblist: boolean }>("/api/lists/sources"), staleTime: 3_600_000 });
  const canConnect = Boolean(sources.data?.mdblist) && !me?.activeProfile?.isKids;
  const custom = (d: { lists: ListSummary[] }) => d.lists.filter((l) => l.kind === "custom");
  const order = (ls: ListSummary[]) =>
    sort === "title" ? [...ls].sort((a, b) => a.name.localeCompare(b.name, locale)) : sort === "size" ? [...ls].sort((a, b) => b.itemCount - a.itemCount) : ls;

  const create = (
    <Button icon={Plus} onClick={() => setCreating(true)}>
      {t("newList")}
    </Button>
  );

  return (
    <div>
      <QueryState
        query={q}
        loading={<GridSkeleton count={6} shape="square" />}
        isEmpty={(d) => custom(d).length === 0}
        // A kids profile's lists are its own: private, not shared with anyone (LIB-26).
        empty={<EmptyState icon={ListVideo} title={t("emptyLists")} text={me?.activeProfile?.isKids ? t("emptyListsHintKids") : t("emptyListsHint")} action={create} />}
        error={{ title: t("loadError") }}
      >
        {(d) => (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Select<Sort>
                aria-label={t("sortLists")}
                size="sm"
                className="w-auto"
                value={sort}
                onValueChange={(v) => set({ sort: v === "updated" ? null : v })}
                options={[
                  { value: "updated", label: t("sortUpdated") },
                  { value: "title", label: t("sortName") },
                  { value: "size", label: t("sortSize") },
                ]}
              />
              <p className="text-body-s tabular-nums text-text-2">{t("listsCount", { count: custom(d).length })}</p>
              <div className="ms-auto">{create}</div>
            </div>
            <ListGrid>
              {order(custom(d)).map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </ListGrid>
          </>
        )}
      </QueryState>
      <CreateListDialog
        open={creating}
        onOpenChange={setCreating}
        onFollow={canConnect ? () => setConnecting(true) : undefined}
        onCreated={async (l) => {
          void qc.invalidateQueries({ queryKey: ["lists"] });
          // The new list opens, so the next step — adding titles — is right there (LIB-15).
          toast.success(t("listCreated", { list: l.name }));
          router.push(`/lists/${l.id}`);
        }}
      />
      {canConnect && <ConnectListDialog open={connecting} onOpenChange={setConnecting} />}
    </div>
  );
}
