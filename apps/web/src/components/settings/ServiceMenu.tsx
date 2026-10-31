"use client";

import { Ellipsis, RotateCcw, Send, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";

export interface ServiceMenuProps {
  label: string;
  items: { reimport: string; send: string; disconnect: string };
  canReimport: boolean;
  canSend: boolean;
  onReimport: () => void;
  onSend: () => void;
  onDisconnect: () => void;
}

/**
 * "More" of a linked Trakt/Simkl account: import everything again, send what's in Lumovio, and — after a separator —
 * disconnect. Loaded when the pointer or the focus comes to its button (TrackingServices' ServiceMore; bundle budget).
 */
export function ServiceMenu(p: ServiceMenuProps & { initialOpen?: boolean; focusTrigger?: boolean }) {
  const [open, setOpen] = useState(p.initialOpen ?? false);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (p.focusTrigger && !p.initialOpen) trigger.current?.focus();
  }, []);
  return (
    <Menu open={open} onOpenChange={setOpen} label={p.label} trigger={<IconButton ref={trigger} icon={Ellipsis} label={p.label} />}>
      <MenuItem icon={RotateCcw} disabled={!p.canReimport} onSelect={p.onReimport}>
        {p.items.reimport}
      </MenuItem>
      <MenuItem icon={Send} disabled={!p.canSend} onSelect={p.onSend}>
        {p.items.send}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={Unlink} tone="danger" onSelect={p.onDisconnect}>
        {p.items.disconnect}
      </MenuItem>
    </Menu>
  );
}
