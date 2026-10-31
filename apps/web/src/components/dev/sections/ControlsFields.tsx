"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FilterChip } from "@/components/ui/Chip";
import { Combobox, type ComboboxOption } from "@/components/ui/Combobox";
import { Field } from "@/components/ui/Field";
import { Input, PasswordInput, SearchInput, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatRuntime } from "@/lib/format";
import { Demo, ShowcaseSection } from "./parts";

// Languages for the long-list example: names come from Intl in the page's language, the language's own name and
// its code also find it.
const LANGUAGES = [
  "en", "ru", "uk", "de", "fr", "es", "it", "pt", "pt-BR", "pl", "cs", "tr", "ar", "he", "hi", "ja", "ko", "zh",
  "nl", "sv", "fi", "nb", "da", "el", "hu", "ro", "kk", "ka",
];
const STUDIOS = ["A24", "Studio Ghibli", "HBO", "Kyoto Animation", "Warner Bros.", "Toho", "MAPPA", "Pixar", "Lionsgate", "Legendary", "Neon", "Madhouse"];

function useLanguageOptions(): ComboboxOption[] {
  const locale = useLocale();
  return useMemo(() => {
    const here = new Intl.DisplayNames([locale], { type: "language" });
    return LANGUAGES.map((code) => {
      const own = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
      const label = here.of(code) ?? code;
      return { value: code, label: label.charAt(0).toLocaleUpperCase(locale) + label.slice(1), keywords: [own, code] };
    }).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale]);
}

function Fields() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  return (
    <ShowcaseSection id="fields" title={t("devUi.fields")} source="ui/Input.tsx · ui/Field.tsx · 7.6">
      <div className="grid max-w-3xl gap-6 md:grid-cols-2">
        <Field label={t("connections.url")} hint={t("devUi.fieldAddressHint")}>
          {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} placeholder="http://192.168.1.10:8096" />}
        </Field>
        <Field label={t("connections.url")} error={t("devUi.fieldAddressError")}>
          {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} defaultValue="192.168.1.10" />}
        </Field>
        <Field label={t("auth.email")} hint={t("devUi.stateDisabled")}>
          {(id, d) => <Input id={id} aria-describedby={d} disabled defaultValue="name@example.com" />}
        </Field>
        <Field label={t("auth.name")} hint={t("devUi.fieldLargeHint")}>
          {(id, d) => <Input id={id} aria-describedby={d} size="lg" />}
        </Field>
        <Field label={t("auth.password")}>
          {(id, d) => <PasswordInput id={id} aria-describedby={d} autoComplete="off" />}
        </Field>
        <Field label={t("search.label")} hideLabel hint={t("devUi.searchHint")}>
          {(id, d) => (
            <SearchInput
              id={id}
              aria-describedby={d}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
            />
          )}
        </Field>
        <Field label={t("devUi.fieldNote")} hint={t("devUi.fieldNoteHint")} className="md:col-span-2">
          {(id, d) => <Textarea id={id} aria-describedby={d} />}
        </Field>
      </div>
    </ShowcaseSection>
  );
}

function Selects() {
  const t = useTranslations();
  const languages = useLanguageOptions();
  const quality = [
    { value: "auto", label: t("title.tsQuality_auto") },
    { value: "best", label: t("title.tsQuality_best") },
    { value: "small", label: t("title.tsQuality_small") },
  ];
  const [q, setQ] = useState<string | undefined>("auto");
  const [q2, setQ2] = useState<string | undefined>(undefined);
  const [lang, setLang] = useState<string | null>("uk");
  const [studios, setStudios] = useState<string[]>(["A24", "Studio Ghibli"]);
  return (
    <ShowcaseSection id="select" title={t("devUi.select")} source="ui/Select.tsx · ui/Combobox.tsx · 7.6">
      <Demo title="Select" note={t("devUi.selectNote")} className="block">
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <Field label={t("devUi.selectQuality")}>
            {(id, d) => <Select id={id} aria-describedby={d} value={q} onValueChange={setQ} options={quality} />}
          </Field>
          <Field label={t("devUi.selectQuality")} error={q2 ? null : t("devUi.selectError")}>
            {(id, d, invalid) => (
              <Select
                id={id}
                aria-describedby={d}
                invalid={invalid}
                value={q2}
                onValueChange={setQ2}
                options={quality}
                placeholder={t("devUi.selectPlaceholder")}
              />
            )}
          </Field>
          <Field label={t("devUi.selectQuality")} hint={t("devUi.stateDisabled")}>
            {(id, d) => <Select id={id} aria-describedby={d} value="best" onValueChange={() => {}} options={quality} disabled />}
          </Field>
        </div>
      </Demo>
      <SmallSelectDemo />
      <Demo title="Combobox" note={t("devUi.comboNote")} className="block">
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <Field label={t("devUi.comboLanguage")}>
            {(id, d) => (
              <Combobox
                id={id}
                aria-describedby={d}
                value={lang}
                onValueChange={setLang}
                options={languages}
                placeholder={t("devUi.selectPlaceholder")}
              />
            )}
          </Field>
          <Field label={t("devUi.comboStudios")} hint={t("devUi.comboMultipleHint")}>
            {(id, d) => (
              <Combobox
                multiple
                id={id}
                aria-describedby={d}
                value={studios}
                onValueChange={setStudios}
                options={STUDIOS.map((s) => ({ value: s, label: s }))}
                placeholder={t("devUi.selectPlaceholder")}
              />
            )}
          </Field>
        </div>
      </Demo>
    </ShowcaseSection>
  );
}

/** `size="sm"`: one height with the chips and small buttons of the same row (library filters, a list's header). */
function SmallSelectDemo() {
  const t = useTranslations();
  const [kind, setKind] = useState<"all" | "movie" | "tv">("all");
  const [max, setMax] = useState("any");
  const [studios, setStudios] = useState<string[]>([]);
  return (
    <Demo title={t("devUi.selectSmall")} note={t("devUi.selectSmallNote")}>
      {(["all", "movie", "tv"] as const).map((k) => (
        <FilterChip key={k} selected={kind === k} onClick={() => setKind(k)}>
          {k === "all" ? t("library.filterAll") : k === "movie" ? t("common.movie") : t("common.series")}
        </FilterChip>
      ))}
      <Select
        size="sm"
        aria-label={t("library.filterRuntime")}
        className="w-auto"
        value={max}
        onValueChange={setMax}
        options={[
          { value: "any", label: t("library.filterRuntimeAny") },
          {
            value: "90",
            label: t("library.filterRuntimeMax", {
              time: formatRuntime(90, (k, v) => t(k as "common.minutes", v)) ?? "",
            }),
          },
        ]}
      />
      {/* Combobox `sm` (a long list in the same row), "Any" as a value rather than a grey hint (X-39). */}
      <Combobox
        multiple
        size="sm"
        aria-label={t("devUi.comboStudios")}
        className="w-48"
        value={studios}
        onValueChange={setStudios}
        options={STUDIOS.map((s) => ({ value: s, label: s }))}
        emptyLabel={t("browse.any")}
      />
      <Button variant="secondary" size="sm">
        {t("common.resetFilters")}
      </Button>
    </Demo>
  );
}

export function ControlsFields() {
  return (
    <>
      <Fields />
      <Selects />
    </>
  );
}
