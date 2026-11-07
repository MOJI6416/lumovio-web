"use client";

import { type Genre, type LibraryRulesList, type ListRules, type ListSummary, MAX_RULE_LISTS, type MediaKind, RULES_CATALOG_LIMIT } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api, ApiRequestError } from "@/lib/api";
import type { BrowseState } from "@/lib/discover";
import { catalogRules } from "@/lib/discover-rules";
import { useAction } from "@/lib/use-action";
import { RuleTags, useRuleWords } from "./RuleTags";
import type { LibraryRules } from "./rules-url";

/** What is being saved: the catalog grid's filters and sort, or a collection tab's filters (and which tab it is). */
export type RulesTarget = { from: "catalog"; kind: MediaKind; state: BrowseState } | { from: "library"; rules: LibraryRules; tab: LibraryRulesList };

/** The smart list whose conditions are being changed ("Edit conditions"): its name and what it holds now. */
export interface RulesEdit {
  id: string;
  name: string;
  rules: ListRules;
}

const LISTS: LibraryRulesList[] = ["watchlist", "favorites"];

/**
 * "Save as list" (package F; design-system 7.9 Dialog): the current filters become a smart list's conditions, shown as
 * labels; a name (suggested from them); for the catalog the personal conditions — "On your servers", "Unwatched" —
 * which only the owner's view applies; for the library, which of the profile's lists it gathers from. With `edit`, the
 * same dialog saves the conditions back into that list ("Edit conditions") and returns to it. A new list says so in a
 * toast with "Open"; the limit of smart lists is said in words.
 */
export function SaveRulesDialog({
  open,
  onOpenChange,
  target,
  edit,
  genres,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: RulesTarget;
  edit?: RulesEdit | null;
  /** The genres the page already has, so their names are there at once. */
  genres?: Genre[];
}) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const router = useRouter();
  const qc = useQueryClient();
  const before = edit?.rules.from === target.from ? edit.rules : null;
  const [onServers, setOnServers] = useState(before?.onServers ?? false);
  const [unwatched, setUnwatched] = useState(before?.unwatched ?? false);
  const [lists, setLists] = useState<LibraryRulesList[]>(before?.from === "library" ? before.lists : target.from === "library" ? [target.tab] : []);
  const rules: ListRules =
    target.from === "catalog"
      ? { from: "catalog", query: catalogRules(target.kind, target.state), onServers, unwatched }
      : { ...target.rules, lists: LISTS.filter((l) => lists.includes(l)) };
  // The suggested name: the conditions without the sort and the personal ones ("Films · Science fiction · Up to 1 h 40 min").
  const words = useRuleWords({ ...rules, onServers: false, unwatched: false }, genres);
  const suggested = (target.from === "catalog" ? words.slice(0, -1) : words).join(" · ").slice(0, 80);
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open && !touched) setName(suggested);
  }, [open, suggested, touched]);

  const save = useAction({
    run: () =>
      edit
        ? api<{ list: ListSummary }>(`/api/lists/${edit.id}/rules`, { method: "PUT", json: { rules } })
        : api<{ list: ListSummary }>("/api/lists/rules", { method: "POST", json: { name: name.trim(), rules } }),
    error: (e) => (e instanceof ApiRequestError && e.code === "conflict" && e.issues?.some((i) => i.path === "rules") ? t("rulesLimit", { count: MAX_RULE_LISTS }) : undefined),
    sync: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!edit && !name.trim()) || rules.from === "library" && rules.lists.length === 0) return;
    const r = await save.run();
    if (!r.ok) return;
    onOpenChange(false);
    const list = r.value.list;
    if (edit) {
      // Back to the list, brought up to date by the new conditions.
      void qc.invalidateQueries({ queryKey: ["list", list.id] });
      toast.success(t("rulesUpdated", { list: list.name }));
      router.push(`/lists/${list.id}`);
      return;
    }
    setTouched(false);
    toast.success(t("rulesSaved", { list: list.name }), { action: { label: t("openList"), onClick: () => router.push(`/lists/${list.id}`) } });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? t("rulesEditTitle", { list: edit.name }) : t("saveAsList")}
      // How the list keeps itself up to date, for a screen reader: the conditions say what it is (1.2).
      description={<span className="sr-only">{target.from === "catalog" ? t("rulesCatalogHint", { limit: RULES_CATALOG_LIMIT }) : t("rulesLibraryHint")}</span>}
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="mb-2 text-body-s font-semibold text-text-1">{t("rulesConditions")}</p>
          <RuleTags rules={rules} label={t("rulesConditions")} known={genres} />
        </div>
        {!edit && (
          <Field label={t("listName")}>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => {
                  setTouched(true);
                  setName(e.target.value);
                }}
                maxLength={80}
                required
              />
            )}
          </Field>
        )}
        {target.from === "catalog" ? (
          <fieldset>
            <legend className="mb-1 text-body-s font-semibold text-text-1">{t("rulesPersonal")}</legend>
            <Checkbox checked={onServers} onCheckedChange={setOnServers} label={t("filterOnServers")} />
            <Checkbox checked={unwatched} onCheckedChange={setUnwatched} label={t("rulesUnwatched")} />
            <p className="mt-1 text-caption font-medium text-text-3">{t("rulesPersonalHint")}</p>
          </fieldset>
        ) : (
          <fieldset>
            <legend className="mb-1 text-body-s font-semibold text-text-1">{t("rulesFrom")}</legend>
            {LISTS.map((l) => (
              <Checkbox
                key={l}
                checked={lists.includes(l)}
                onCheckedChange={(on) => setLists((ls) => (on ? [...ls, l] : ls.filter((x) => x !== l)))}
                label={t(l)}
              />
            ))}
            {/* At least one list: "Save" waits for it and says why. */}
            {lists.length === 0 && <p className="mt-1 text-caption font-medium text-text-3">{t("rulesFromNone")}</p>}
            {(rules.onServers || rules.unwatched) && <p className="mt-1 text-caption font-medium text-text-3">{t("rulesPersonalHint")}</p>}
          </fieldset>
        )}
        <DialogActions>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={save.pending} disabled={(!edit && !name.trim()) || (target.from === "library" && lists.length === 0)}>
            {edit ? t("rulesSaveConditions") : t("rulesSaveList")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
