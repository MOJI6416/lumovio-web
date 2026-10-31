"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import type { InfoTipContent } from "./InfoTip";
import { Popover } from "./Popover";

/** The full "i" (./InfoTip): a Popover with the note, how it was picked or its sources, and an optional link. */
export function InfoTipPopover({
  title,
  label,
  note,
  rules,
  link,
  initialOpen,
  focusTrigger,
}: InfoTipContent & { title: string; label: string; initialOpen: boolean; focusTrigger: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);
  return (
    <Popover title={title} showTitle align="start" open={open} onOpenChange={setOpen} trigger={<IconButton ref={trigger} icon={Info} size="sm" label={label} />}>
      {note && <p className="text-body text-text-1">{note}</p>}
      {rules && <p className="mt-2 text-body-s text-text-2">{rules}</p>}
      {link && <div className="mt-3">{link}</div>}
    </Popover>
  );
}
