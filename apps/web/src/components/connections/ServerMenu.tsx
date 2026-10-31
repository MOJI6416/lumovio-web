"use client";

import type { ConnectionSummary } from "@lumovio/contracts";
import { Ellipsis, ListVideo, RefreshCw, ScanLine, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import type { ServerActions } from "./server-actions";

export interface ServerMenuProps {
  conn: ConnectionSummary;
  access: boolean;
  actions: ServerActions;
}

/**
 * A server row's "More" (7.16): check, scan or the added releases — only with the profile's access — then "Remove
 * server" after a separator. Loaded when the pointer comes near the button or it gets the focus (ConnectionsView's
 * ServerMore, as ui/Select): the menu brings Radix with it (bundle budget).
 */
export function ServerMenu({ conn: c, access, actions, initialOpen = false, focusTrigger = false }: ServerMenuProps & { initialOpen?: boolean; focusTrigger?: boolean }) {
  const t = useTranslations("connections");
  const tm = useTranslations("torrentManager");
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger && !initialOpen) trigger.current?.focus();
  }, []);
  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      label={t("moreFor", { name: c.name })}
      title={c.name}
      trigger={<IconButton ref={trigger} icon={Ellipsis} label={t("moreFor", { name: c.name })} />}
    >
      {access && (
        <MenuItem icon={RefreshCw} disabled={actions.busy !== null} onSelect={() => void actions.test()}>
          {t("test")}
        </MenuItem>
      )}
      {access && c.kind !== "torrserver" && (
        <MenuItem icon={ScanLine} disabled={actions.busy !== null} onSelect={() => void actions.scan()}>
          {t("sync")}
        </MenuItem>
      )}
      {access && c.kind === "torrserver" && (
        <MenuItem icon={ListVideo} href={`/settings/connections/${c.id}/torrents`}>
          {tm("open")}
        </MenuItem>
      )}
      {access && <MenuSeparator />}
      <MenuItem icon={Trash2} tone="danger" onSelect={() => void actions.remove()}>
        {t("remove")}
      </MenuItem>
    </Menu>
  );
}
