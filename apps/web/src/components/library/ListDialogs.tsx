"use client";

import type { ListDetails, ListVisibility } from "@lumovio/contracts";
import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { Copy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Checkbox";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

type Member = ListDetails["members"][number];

/**
 * "Edit list" (LIB-06, LIB-08, LIB-15): the name and description (custom lists), who sees it and whether others may add
 * titles — one form, one "Save", a toast when it is saved; the dialog stays open with the error otherwise. A kids
 * profile's lists stay private (the server refuses anything else), so it isn't asked.
 */
export function EditListDialog({ list: l, open, onOpenChange, kids }: { list: ListDetails; open: boolean; onOpenChange: (o: boolean) => void; kids: boolean }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const custom = l.kind === "custom";
  const [name, setName] = useState(l.name);
  const [description, setDescription] = useState(l.description ?? "");
  const [visibility, setVisibility] = useState<ListVisibility>(l.visibility);
  const [collaborative, setCollaborative] = useState(l.collaborative);
  // Each opening starts from the list as it is now.
  useEffect(() => {
    if (!open) return;
    setName(l.name);
    setDescription(l.description ?? "");
    setVisibility(l.visibility);
    setCollaborative(l.collaborative);
  }, [open, l.name, l.description, l.visibility, l.collaborative]);
  const changed = name.trim() !== l.name || (description.trim() || null) !== (l.description ?? null) || visibility !== l.visibility || collaborative !== l.collaborative;
  const save = useAction({
    run: () =>
      api<ListDetails>(`/api/lists/${l.id}`, {
        method: "PATCH",
        json: custom ? { name: name.trim(), description: description.trim() || null, visibility, collaborative } : { visibility },
      }),
    success: () => t("listSaved"),
    sync: () => {
      void qc.invalidateQueries({ queryKey: ["list", l.id] });
      void qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("editList")}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !changed) return;
          if ((await save.run()).ok) onOpenChange(false);
        }}
      >
        {custom && (
          <>
            <Field label={t("listName")}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />}</Field>
            <Field label={`${t("description")} (${tc("optional")})`}>
              {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />}
            </Field>
          </>
        )}
        {!kids && (
          <Field label={t("visibility")} hint={t(`visibilityHint_${visibility}`)}>
            {(id, describedBy) => (
              <Select<ListVisibility>
                id={id}
                aria-describedby={describedBy}
                value={visibility}
                onValueChange={setVisibility}
                options={(["private", "unlisted", "public"] as const).map((v) => ({ value: v, label: t(`visibility_${v}`) }))}
              />
            )}
          </Field>
        )}
        {custom && !kids && (
          <Switch checked={collaborative} onCheckedChange={setCollaborative} label={t("collaborative")} description={<span className="sr-only">{t("collaborativeHint")}</span>} />
        )}
        <DialogActions>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={save.pending} disabled={!name.trim() || !changed}>
            {tc("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * Members and their roles (LIB-06): the owner changes a member's role in place (no toast — the Select shows it) and
 * removes a profile after a confirmation; everyone else sees who is in the list.
 */
export function MembersDialog({ list: l, open, onOpenChange, isOwner }: { list: ListDetails; open: boolean; onOpenChange: (o: boolean) => void; isOwner: boolean }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const confirm = useConfirm();
  const key = ["list", l.id];
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const setRole = useAction({
    run: (m: Member, role: "editor" | "viewer") => api(`/api/lists/${l.id}/members/${m.profileId}`, { method: "PATCH", json: { role } }),
    optimistic: (m: Member, role: "editor" | "viewer") => {
      // The list page keeps its pages under this key (LIB-24); each page carries the members.
      const before = qc.getQueryData<InfiniteData<ListDetails>>(key);
      qc.setQueryData<InfiniteData<ListDetails>>(
        key,
        (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, members: p.members.map((x) => (x.profileId === m.profileId ? { ...x, role } : x)) })) },
      );
      return () => qc.setQueryData(key, before);
    },
    error: (_, m) => t("roleChangeFailed", { name: m.name }),
    sync: refresh,
  });
  const remove = async (m: Member) => {
    const ok = await confirm({
      title: t("removeMemberTitle", { name: m.name, list: l.name }),
      text: t("removeMemberText"),
      confirmLabel: t("removeMember"),
      action: () => api(`/api/lists/${l.id}/members/${m.profileId}`, { method: "DELETE" }),
      error: t("removeMemberFailed", { name: m.name }),
    });
    if (!ok) return;
    toast.success(t("memberRemoved", { name: m.name }));
    void refresh();
  };
  return (
    // Who may change what is the dialog's description for a screen reader: the controls say it (1.2).
    <Dialog open={open} onOpenChange={onOpenChange} title={t("members")} description={<span className="sr-only">{t("membersHint")}</span>}>
      <ul className="divide-y divide-line">
        {l.members.map((m) => (
          <li key={m.profileId} className="flex items-center gap-3 py-3">
            <ProfileAvatar avatar={m.avatar} photo={m.photo} name={m.name} size={32} />
            <span className="min-w-0 flex-1 truncate text-title text-text-1">{m.name}</span>
            {isOwner && m.role !== "owner" ? (
              <>
                <Select<"editor" | "viewer">
                  aria-label={t("roleOf", { name: m.name })}
                  size="sm"
                  className="w-auto"
                  value={m.role}
                  onValueChange={(r) => void setRole.run(m, r)}
                  options={[
                    { value: "editor", label: t("role_editor") },
                    { value: "viewer", label: t("role_viewer") },
                  ]}
                />
                <IconButton icon={X} label={t("removeMemberLabel", { name: m.name })} onClick={() => void remove(m)} />
              </>
            ) : (
              <span className="text-body-s text-text-2">{t(`role_${m.role}`)}</span>
            )}
          </li>
        ))}
      </ul>
      <DialogActions>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {tc("close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const TTL_HOURS = 72;

/**
 * Inviting (LIB-16): what the invited person may do — two labelled choices with what each means — then "Create link";
 * the link in a labelled field with "Copy link" and the chosen role and lifetime said next to it.
 */
export function InviteDialog({ list: l, open, onOpenChange }: { list: ListDetails; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState<{ url: string; role: "editor" | "viewer" } | null>(null);
  const create = useAction({
    run: () => api<{ url: string }>(`/api/lists/${l.id}/invites`, { method: "POST", json: { role, ttlHours: TTL_HOURS } }),
    // An editor's invitation makes the list shared: the page shows it.
    sync: () => qc.invalidateQueries({ queryKey: ["list", l.id] }),
  });
  const copy = useAction({ run: (text: string) => navigator.clipboard.writeText(text), success: tc("copied") });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setLink(null);
      }}
      title={t("inviteTitle", { list: l.name })}
    >
      {!link ? (
        <div className="space-y-5">
          <RadioGroup<"editor" | "viewer">
            legend={t("inviteRole")}
            value={role}
            onValueChange={setRole}
            options={[
              { value: "editor", label: t("role_editor"), description: t("inviteEditorHint") },
              { value: "viewer", label: t("role_viewer"), description: t("inviteViewerHint") },
            ]}
          />
          <DialogActions>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button
              loading={create.pending}
              onClick={async () => {
                const r = await create.run();
                if (r.ok) setLink({ url: r.value.url, role });
              }}
            >
              {t("createInviteLink")}
            </Button>
          </DialogActions>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label={t("inviteLink")} hint={t("inviteLinkHint", { role: t(`role_${link.role}`), hours: TTL_HOURS })}>
            {(id, describedBy) => (
              <div className="flex gap-2">
                <Input id={id} aria-describedby={describedBy} readOnly value={link.url} className="min-w-0 flex-1" onFocus={(e) => e.target.select()} />
                <Button variant="secondary" icon={Copy} onClick={() => void copy.run(link.url)}>
                  {t("copyLink")}
                </Button>
              </div>
            )}
          </Field>
          <DialogActions>
            <Button variant="secondary" onClick={() => setLink(null)}>
              {t("inviteAnother")}
            </Button>
            <Button onClick={() => onOpenChange(false)}>{tc("done")}</Button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
