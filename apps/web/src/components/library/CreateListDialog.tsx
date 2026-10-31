"use client";

import type { ListSummary, ListVisibility } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/**
 * "New list": name, description, who sees it, shared or not. The one way to create a list (LIB-13); `onFollow` adds
 * the other way to start one — following an external list (MDBList) — as a quiet link inside, not a second button
 * beside "New list".
 */
export function CreateListDialog({
  open,
  onOpenChange,
  onCreated,
  onFollow,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (l: ListSummary) => void | Promise<void>;
  onFollow?: () => void;
}) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const { me } = useSession();
  const kids = me?.activeProfile?.isKids ?? false;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ListVisibility>("private");
  const [collaborative, setCollaborative] = useState(false);
  // The new list shows up where it was asked for; a failure says why in a toast (8.3).
  const create = useAction({
    run: async () => {
      const l = await api<ListSummary>("/api/lists", { method: "POST", json: { name, description: description || null, visibility, collaborative } });
      await onCreated?.(l);
      return l;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!(await create.run()).ok) return;
    onOpenChange(false);
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("newList")}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t("listName")}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />}</Field>
        <Field label={`${t("description")} (${tc("optional")})`}>
          {(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}
        </Field>
        {!kids && (
          <>
            <Field label={t("visibility")}>
              {(id) => (
                <Select<ListVisibility>
                  id={id}
                  value={visibility}
                  onValueChange={setVisibility}
                  options={(["private", "unlisted", "public"] as const).map((v) => ({ value: v, label: t(`visibility_${v}`) }))}
                />
              )}
            </Field>
            <Switch checked={collaborative} onCheckedChange={setCollaborative} label={t("collaborative")} description={t("collaborativeHint")} />
          </>
        )}
        {onFollow && (
          <p className="text-body-s text-text-2">
            {t("followInstead")}{" "}
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onFollow();
              }}
            >
              {t("connectList")}
            </Button>
          </p>
        )}
        <DialogActions>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={create.pending} disabled={!name.trim()}>
            {t("createList")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
