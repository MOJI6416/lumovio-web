"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PickPill } from "@/components/title/WatchCard";
import { Menu, MenuCheckboxItem } from "@/components/ui/Menu";

/** One copy as the "Copy" choice lists it. */
export interface CopyPickItem {
  key: string;
  /** What is heard: the card's heading for this copy. */
  heard: string;
  /** Its marks with the words they don't say, the size and the server (QualityLine). */
  line: ReactNode;
  /** The line in words, to tell two copies apart: copies whose heading and line read the same also show their names. */
  detail: string;
  /** Its release's full name. */
  name: string | null;
  /** "Now" or "Didn't start" on the sources screen. */
  tag?: ReactNode;
}

/**
 * "Copy" in the card's row when the profile's servers hold more than one: the pill says which of them the card shows
 * ("1 of 2"), its menu (a sheet on a phone) lists each by what is heard and its marks, size and server — and, for two
 * that read the same, the names of their releases, the one thing that tells them apart. Choosing one changes the card
 * and its "Watch"; nothing starts or is added.
 */
export function CopyPill({ items, current, onPick, disabled }: { items: CopyPickItem[]; current: string; onPick: (key: string) => void; disabled?: boolean }) {
  const t = useTranslations("titlePage");
  const tt = useTranslations("title");
  const index = Math.max(0, items.findIndex((i) => i.key === current));
  const twin = (a: CopyPickItem) => items.some((b) => b !== a && b.heard === a.heard && b.detail === a.detail);
  const name = t("copyPick");
  const value = t("copyOf", { n: index + 1, count: items.length });
  return (
    <Menu label={name} align="start" trigger={<PickPill name={name} value={value} disabled={disabled} aria-label={tt("pickValue", { name, value })} />}>
      {items.map((i) => (
        <MenuCheckboxItem key={i.key} checked={i.key === current} onCheckedChange={() => onPick(i.key)}>
          {i.tag && <span className="mb-1 flex">{i.tag}</span>}
          <span className="block">{i.heard}</span>
          <span className="block text-body-s text-text-2">{i.line}</span>
          {twin(i) && i.name && <span className="mt-0.5 line-clamp-2 break-all text-caption text-text-3">{i.name}</span>}
        </MenuCheckboxItem>
      ))}
    </Menu>
  );
}
