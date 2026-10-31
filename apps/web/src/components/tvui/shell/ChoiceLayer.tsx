"use client";

import { Check } from "lucide-react";
import { useRef } from "react";
import { TvButton } from "@/components/ui/tv/TvButton";
import { TvLayer } from "../nav/TvLayer";
import { TvScroll } from "../nav/TvScroll";

export interface Choice {
  value: string;
  label: string;
}

/**
 * One choice from a list on a TV (design-system 7.6, 10.3 — a Select's TV variant): a side panel with the options as
 * rows, the current one marked and focused first; OK picks and closes, Back closes without a change.
 */
export function ChoiceLayer({
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  options: Choice[];
  value: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  // Applied once the layer's history entry is gone: a change of the address before that would land in the layer's entry.
  const picked = useRef<string | null>(null);
  return (
    <TvLayer
      look="panel"
      label={title}
      onClose={() => {
        onClose();
        if (picked.current !== null && picked.current !== value) onPick(picked.current);
      }}
    >
      {(close) => (
        <>
          <h2 className="text-h2 text-text-1">{title}</h2>
          <TvScroll contentClassName="p-2">
            <div
              data-zone="choice"
              data-zone-axis="y"
              role="radiogroup"
              aria-label={title}
              className="flex flex-col gap-3"
            >
              {options.map((o) => (
                <TvButton
                  key={o.value}
                  look="row"
                  role="radio"
                  aria-checked={o.value === value}
                  data-key={o.value}
                  data-tv-initial={o.value === value || undefined}
                  onClick={() => {
                    picked.current = o.value;
                    close();
                  }}
                >
                  <span className="flex-1">{o.label}</span>
                  {o.value === value && <Check aria-hidden />}
                </TvButton>
              ))}
            </div>
          </TvScroll>
        </>
      )}
    </TvLayer>
  );
}
