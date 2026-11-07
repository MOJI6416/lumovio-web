"use client";

import { Delete, Search, Space, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { TvButton } from "@/components/ui/tv/TvButton";

/** Letters of the on-screen keyboard: the interface language's alphabet, and Latin for original titles. */
const ALPHABETS: Record<string, string> = {
  ru: "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
  uk: "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя",
  de: "abcdefghijklmnopqrstuvwxyzäöüß",
  es: "abcdefghijklmnñopqrstuvwxyz",
  fr: "abcdefghijklmnopqrstuvwxyzéèàç",
  "pt-BR": "abcdefghijklmnopqrstuvwxyzãõçáé",
  it: "abcdefghijklmnopqrstuvwxyzàèéìòù",
  pl: "aąbcćdeęfghijklłmnńoóprsśtuwyzźż",
  tr: "abcçdefgğhıijklmnoöprsştuüvyz",
};
const LATIN = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "1234567890";

/**
 * Typing on a TV (design-system 10.3 "Поиск"): a real field — OK on it opens the TV's own keyboard, Enter there is
 * `onSubmit` — and the on-screen keyboard under it: the interface language's alphabet, Latin, digits, space, ⌫,
 * clear. Text typed on the phone remote (tvui/shell/TvEvents) replaces the field's. Zones "query", "keyboard", "keys".
 * The search screen's and the sources screen's query.
 */
export function TvKeyboard({
  value,
  onChange,
  label,
  placeholder,
  onSubmit,
  initial = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  onSubmit?: () => void;
  /** The screen starts on its first key — not when it starts elsewhere (a search type's grid). */
  initial?: boolean;
}) {
  const tv = useTranslations("tvui");
  const locale = useLocale();
  const [set, setSet] = useState<"native" | "latin" | "digits">(ALPHABETS[locale] ? "native" : "latin");
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    const onText = (e: Event) => change.current((e as CustomEvent<string>).detail.slice(0, 100));
    window.addEventListener("lumovio:tv-text", onText);
    return () => window.removeEventListener("lumovio:tv-text", onText);
  }, []);

  const type = (s: string) => onChange((value + s).slice(0, 100));
  const letters = set === "digits" ? DIGITS : set === "latin" ? LATIN : (ALPHABETS[locale] ?? LATIN);
  return (
    <>
      {/* A real field: OK on it opens the TV's own keyboard (and a phone's remote types into it). */}
      <div data-zone="query" data-zone-down="keyboard" className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-5 top-1/2 size-6 -translate-y-1/2 text-text-3"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 100))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) onSubmit();
          }}
          aria-label={label}
          placeholder={placeholder}
          enterKeyHint="search"
          autoComplete="off"
          data-tv-search-field
          className="tv-focus h-14 w-full rounded-full border-2 border-line-2 bg-surface-2 ps-14 pe-5 text-body-l text-text-1 placeholder:text-text-3 focus:border-transparent"
        />
      </div>
      <div data-zone="keyboard" data-zone-axis="grid" data-zone-up="query" className="grid grid-cols-7 gap-2">
        {[...letters].map((ch, i) => (
          <TvButton
            key={`${set}${ch}`}
            data-key={`${set}:${ch}`}
            data-tv-initial={(initial && i === 0) || undefined}
            className="h-12 min-w-0 px-0 text-h3"
            onClick={() => type(ch)}
          >
            {ch}
          </TvButton>
        ))}
      </div>
      <div data-zone="keys" data-zone-axis="grid" data-zone-up="keyboard" className="grid grid-cols-4 gap-2">
        <TvButton
          icon={Space}
          label={tv("space")}
          look="round"
          className="h-12 w-full rounded-sm"
          onClick={() => type(" ")}
        />
        <TvButton
          icon={Delete}
          label={tv("eraseLetter")}
          look="round"
          className="h-12 w-full rounded-sm"
          disabled={!value}
          onClick={() => onChange(value.slice(0, -1))}
        />
        <TvButton
          icon={X}
          label={tv("clearQuery")}
          look="round"
          className="h-12 w-full rounded-sm"
          disabled={!value}
          onClick={() => onChange("")}
        />
        <TvButton
          className="h-12 min-w-0 px-0"
          aria-label={tv("otherKeys")}
          onClick={() =>
            setSet((s) =>
              s === "native" ? "latin" : s === "latin" ? "digits" : ALPHABETS[locale] ? "native" : "latin",
            )
          }
        >
          {set === "digits"
            ? ALPHABETS[locale]
              ? (ALPHABETS[locale] ?? "").slice(0, 3).toUpperCase()
              : "ABC"
            : set === "native"
              ? "ABC"
              : "123"}
        </TvButton>
      </div>
    </>
  );
}
