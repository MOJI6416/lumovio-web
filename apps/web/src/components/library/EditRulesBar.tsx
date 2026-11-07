"use client";

import type { ListDetails } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonClass } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { apiErrorKey, isRetryable } from "@/lib/api-errors";
import type { RulesEdit } from "./SaveRulesDialog";

/**
 * "Edit conditions" of a smart list (package F) opens the catalog grid or the library tab with its conditions and
 * `?editList=`: this banner over the filters says whose conditions are being changed, "Save conditions" (the dialog
 * that saves them back into the same list) and "Cancel" back to the list. A list that can't be changed here (gone,
 * not one's own, not a smart list) says so, with the way back to the lists.
 */
export function EditRulesBar({ listId, onSave, className }: { listId: string; onSave: (edit: RulesEdit) => void; className?: string }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const q = useQuery({ queryKey: ["list-rules", listId], queryFn: () => api<ListDetails>(`/api/lists/${listId}`), staleTime: 60_000, retry: false });

  if (q.isPending) return <InlineAlert className={className} title={t("rulesEditing")} />;
  const l = q.data;
  if (q.isError || !l?.rules || l.role !== "owner") {
    const retry = q.isError && isRetryable(q.error);
    return (
      <InlineAlert
        tone="warning"
        className={className}
        title={q.isError && retry ? tr(apiErrorKey(q.error)) : t("rulesEditMissing")}
        action={
          retry ? (
            <Button variant="tertiary" size="sm" loading={q.isFetching} onClick={() => void q.refetch()}>
              {tc("retry")}
            </Button>
          ) : (
            <Link href="/library?tab=lists" className={buttonClass("tertiary", "sm")}>
              {t("toMyLists")}
            </Link>
          )
        }
      />
    );
  }
  return (
    <InlineAlert
      className={className}
      title={t("rulesEditingList", { list: l.name })}
      action={
        <div className="flex flex-wrap gap-1">
          <Button variant="tertiary" size="sm" icon={Check} onClick={() => onSave({ id: l.id, name: l.name, rules: l.rules!.rules })}>
            {t("rulesSaveConditions")}
          </Button>
          <Link href={`/lists/${l.id}`} className={buttonClass("tertiary", "sm")}>
            {tc("cancel")}
          </Link>
        </div>
      }
    >
      {/* What to do, for a screen reader: the title and the two buttons say it (1.2). */}
      <span className="sr-only">{t("rulesEditingText")}</span>
    </InlineAlert>
  );
}
