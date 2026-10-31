"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { InputChip } from "@/components/ui/Chip";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { IconButton } from "@/components/ui/IconButton";

/**
 * A short ordered choice from a long list (design-system 7.18): audio and subtitle languages, voice-over studios. The
 * chosen ones are a numbered list of InputChips (× takes one away) with ↑/↓ to change the order; a Combobox under
 * them adds one more. Not a wall of chips: only what was chosen is on the screen. Every change is one call of
 * `onChange` with the whole new list — the settings save it at once (8.8).
 */
export function OrderedChoice({
  value,
  options,
  onChange,
  addLabel,
  listLabel,
  max,
  disabled,
  describedBy,
}: {
  value: string[];
  options: ComboboxOption[];
  onChange: (next: string[]) => void;
  /** The Combobox's words: "Add a language". */
  addLabel: string;
  /** Names the list for screen readers: "Audio languages, in order of preference". */
  listLabel: string;
  max: number;
  disabled?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("settings");
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const list = useRef<HTMLOListElement>(null);
  // Moving an item re-orders the DOM, which drops the focus: it is put back on the moved item's arrow.
  const refocus = useRef<{ item: string; dir: "up" | "down" } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: after each change of the list
  useEffect(() => {
    const want = refocus.current;
    if (!want) return;
    refocus.current = null;
    const li = list.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(want.item)}"]`);
    const same = li?.querySelector<HTMLButtonElement>(`[data-move="${want.dir}"]:not(:disabled)`);
    (same ?? li?.querySelector<HTMLButtonElement>("[data-move]:not(:disabled)"))?.focus();
  }, [value]);

  const move = (i: number, dir: "up" | "down") => {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    refocus.current = { item: value[i]!, dir };
    onChange(next);
  };
  const free = options.filter((o) => !value.includes(o.value));

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:w-80">
      {value.length > 0 && (
        <ol ref={list} aria-label={listLabel} className="flex flex-col gap-1">
          {value.map((v, i) => (
            <li key={v} data-item={v} className="flex min-w-0 items-center gap-1">
              <span aria-hidden className="w-6 shrink-0 text-body-s font-semibold tabular-nums text-text-2">
                {i + 1}.
              </span>
              <InputChip
                label={labelOf(v)}
                disabled={disabled}
                onRemove={() => onChange(value.filter((x) => x !== v))}
                className="me-auto min-w-0"
              />
              <IconButton
                icon={ArrowUp}
                size="sm"
                data-move="up"
                label={t("moveUp", { item: labelOf(v) })}
                disabled={disabled || i === 0}
                onClick={() => move(i, "up")}
              />
              <IconButton
                icon={ArrowDown}
                size="sm"
                data-move="down"
                label={t("moveDown", { item: labelOf(v) })}
                disabled={disabled || i === value.length - 1}
                onClick={() => move(i, "down")}
              />
            </li>
          ))}
        </ol>
      )}
      {value.length < max ? (
        <Combobox
          value={null}
          onValueChange={(v) => onChange([...value, v])}
          options={free}
          placeholder={addLabel}
          aria-label={addLabel}
          aria-describedby={describedBy}
          disabled={disabled}
        />
      ) : (
        <p className="text-body-s text-text-2">{t("choiceMax", { count: max })}</p>
      )}
    </div>
  );
}
