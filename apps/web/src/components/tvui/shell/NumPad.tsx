"use client";

import { Check, Delete } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { TvButton } from "@/components/ui/tv/TvButton";

/*
 * Digits by remote: an on-screen keypad and the remote's own 0–9, for a profile's PIN and a
 * mailed code. What is typed shows as dots (a PIN) or digits (a code); "Done" sends, ⌫ takes one back.
 */
export function NumPad({
  value,
  onChange,
  onDone,
  max,
  min,
  secret,
  busy,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onDone: () => void;
  max: number;
  min: number;
  secret?: boolean;
  busy?: boolean;
  label: string;
}) {
  const t = useTranslations("tvui");
  const tc = useTranslations("common");

  // The remote's digits and its "clear" keys type straight into the pad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        if (value.length < max) onChange(value + e.key);
      } else if (e.key === "Backspace" && value) {
        e.preventDefault();
        onChange(value.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [value, max, busy, onChange]);

  const cells = Array.from({ length: Math.max(min, value.length) }, (_, i) => value[i]);
  const key = (d: string) => (
    <TvButton
      key={d}
      data-key={d}
      className="size-14 rounded-full px-0 text-h3 tabular-nums"
      disabled={busy}
      onClick={() => value.length < max && onChange(value + d)}
    >
      {d}
    </TvButton>
  );
  return (
    <div className="flex flex-col items-center gap-8">
      <div role="status" aria-label={label} className="flex gap-3">
        {cells.map((c, i) => (
          <span
            key={i}
            className="grid size-14 place-items-center rounded-sm border-2 border-line-2 text-h2 text-text-1 tabular-nums"
          >
            {c === undefined ? "" : secret ? "•" : c}
          </span>
        ))}
      </div>
      <div data-zone="numpad" data-zone-axis="grid" className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(key)}
        <TvButton
          look="round"
          icon={Delete}
          label={t("eraseDigit")}
          className="size-14"
          disabled={!value || busy}
          onClick={() => onChange(value.slice(0, -1))}
        />
        {key("0")}
        <TvButton
          look="round"
          icon={Check}
          label={tc("done")}
          className="size-14"
          disabled={value.length < min}
          loading={busy}
          onClick={onDone}
        />
      </div>
    </div>
  );
}
