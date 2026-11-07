"use client";

import type { ListSummary } from "@lumovio/contracts";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DialogActions } from "@/components/ui/Dialog";
import { Dialog } from "@/components/ui/DialogFrame";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useEditableLists, type usePersonalActions } from "./usePersonalActions";

/**
 * "Add to list…" (design-system 8.1, TTL-09): the profile's lists with a check each, changed at once; "New list" makes
 * one and puts the title in it. One picker for a card's "More" (./CardMenu) and the title page's (title/TitleMore).
 */
export function ListPicker({
  open,
  onOpenChange,
  title,
  actions,
  onNew,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions: ReturnType<typeof usePersonalActions>;
  onNew: () => void;
}) {
  const t = useTranslations("card");
  const tc = useTranslations("common");
  const lists = useEditableLists(open);
  const inList = (l: ListSummary) => actions.state?.listIds.includes(l.id) ?? false;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("addToListTitle")} description={title} size="sm">
      {lists.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : lists.isError ? (
        <ErrorState variant="inline" error={lists.error} title={t("listsFailed")} onRetry={() => void lists.refetch()} retrying={lists.isFetching} />
      ) : lists.data.length === 0 ? (
        <EmptyState variant="inline" title={t("noLists")} />
      ) : (
        <ul className="-my-1 flex max-h-80 flex-col gap-1 overflow-y-auto">
          {lists.data.map((l) => (
            <li key={l.id}>
              <Checkbox label={l.name} description={tc("titlesCount", { count: l.itemCount })} checked={inList(l)} onCheckedChange={() => void actions.toggleList(l.id)} />
            </li>
          ))}
        </ul>
      )}
      <DialogActions>
        <Button variant="secondary" icon={Plus} onClick={onNew}>
          {t("newList")}
        </Button>
        <Button onClick={() => onOpenChange(false)}>{tc("done")}</Button>
      </DialogActions>
    </Dialog>
  );
}
