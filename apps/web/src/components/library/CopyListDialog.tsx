"use client";

import type { ListSummary } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/**
 * "Save as a regular list" of a smart list (package F, "Fixing"): what the list shows now becomes an independent
 * ordinary list under its own name; the smart list itself stays and keeps updating — it never turns into an ordinary
 * one unnoticed. The new list is announced with "Open".
 */
export function CopyListDialog({ list, open, onOpenChange }: { list: { id: string; name: string }; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(list.name);
  const copy = useAction({
    run: () => api<ListSummary>(`/api/lists/${list.id}/copy`, { method: "POST", json: { name: name.trim() } }),
    sync: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await copy.run();
    if (!r.ok) return;
    onOpenChange(false);
    toast.success(t("rulesCopied", { list: r.value.name, count: r.value.itemCount }), {
      action: { label: t("openList"), onClick: () => router.push(`/lists/${r.value.id}`) },
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("rulesCopy")} description={t("rulesCopyHint")}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("listName")}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />}</Field>
        <DialogActions>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={copy.pending} disabled={!name.trim()}>
            {t("rulesCopySave")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
