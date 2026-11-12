"use client";

import type { ListDetails } from "@lumovio/contracts";
import { CopyPlus, Ellipsis, LogOut, Pencil, RefreshCw, RotateCcw, Trash2, Unlink, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { useAction } from "@/lib/use-action";
import { sourceErrorKey } from "./ConnectListDialog";

export type ListDialog = "edit" | "members" | "invite" | "copy";

/**
 * A list's "More": Edit list, Members, Invite; a followed MDBList list's
 * "Refresh now" and "Unfollow"; a smart list's "Save as a regular list"; "Bring back N removed titles" of a followed
 * or smart list; and — last, after a separator — Delete list (the owner) or Leave list (a member). Loaded by ListView
 * when the pointer comes near its button, it gets the focus or the browser is idle; it then takes the light button's
 * place (ui/lazy-swap).
 */
export function ListMenu({
  list: l,
  isOwner,
  kids,
  label,
  initialOpen,
  focusTrigger,
  onDialog,
  onDeleteOrLeave,
  onUnfollow,
  onChange,
}: {
  list: ListDetails;
  isOwner: boolean;
  kids: boolean;
  label: string;
  initialOpen: boolean;
  focusTrigger: boolean;
  onDialog: (d: ListDialog) => void;
  onDeleteOrLeave: () => void;
  /** A followed list's "Unfollow" (asked first by ListView). */
  onUnfollow: () => void;
  onChange: () => unknown;
}) {
  const t = useTranslations("library");
  const tr = useTranslations();
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);
  const custom = l.kind === "custom";
  // Titles removed by hand that a followed or smart list doesn't bring back.
  const hidden = l.source?.hidden ?? l.rules?.hidden ?? 0;
  const words = (e: unknown) => {
    const k = sourceErrorKey(e);
    return k ? t(k) : tr(apiErrorKey(e));
  };
  const restore = useAction({
    run: () => api<{ sync: { added: number; removed: number } | null }>(`/api/lists/${l.id}/source/restore`, { method: "POST", json: {} }),
    success: (r) => (r.sync ? t("sourceSynced", { added: r.sync.added, removed: r.sync.removed }) : t("sourceRestoredLater")),
    error: words,
    sync: onChange,
  });
  const refresh = useAction({
    run: () => api<{ sync: { added: number; removed: number } | null }>(`/api/lists/${l.id}/source/refresh`, { method: "POST", json: {} }),
    success: (r) => (r.sync ? t("sourceSynced", { added: r.sync.added, removed: r.sync.removed }) : t("sourceUpToDate")),
    error: words,
    sync: onChange,
  });
  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      label={t("listMenu")}
      title={l.name}
      trigger={<IconButton ref={trigger} icon={Ellipsis} variant="secondary" label={label} />}
    >
      {isOwner && (
        <MenuItem icon={Pencil} onSelect={() => onDialog("edit")}>
          {t("editList")}
        </MenuItem>
      )}
      {custom && (
        <MenuItem icon={Users} onSelect={() => onDialog("members")}>
          {t("members")}
        </MenuItem>
      )}
      {isOwner && custom && !kids && (
        <MenuItem icon={UserPlus} onSelect={() => onDialog("invite")}>
          {t("invite")}
        </MenuItem>
      )}
      {isOwner && l.source && (
        <>
          <MenuItem icon={RefreshCw} onSelect={() => void refresh.run()}>
            {t("sourceRefresh")}
          </MenuItem>
          <MenuItem icon={Unlink} onSelect={onUnfollow}>
            {t("sourceDisconnect")}
          </MenuItem>
        </>
      )}
      {isOwner && l.rules && (
        <MenuItem icon={CopyPlus} onSelect={() => onDialog("copy")}>
          {t("rulesCopy")}
        </MenuItem>
      )}
      {isOwner && hidden > 0 && (
        <MenuItem icon={RotateCcw} onSelect={() => void restore.run()}>
          {t("sourceRestore", { count: hidden })}
        </MenuItem>
      )}
      {custom && (
        <>
          <MenuSeparator />
          <MenuItem icon={isOwner ? Trash2 : LogOut} tone="danger" onSelect={onDeleteOrLeave}>
            {isOwner ? t("deleteList") : t("leave")}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
