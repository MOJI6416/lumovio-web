"use client";

import type { ArtImage, MediaKind } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { QueryState } from "@/components/ui/QueryState";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { api, ApiRequestError } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { tmdbImage } from "@/lib/images";
import { useAction } from "@/lib/use-action";

interface Choices {
  backdrops: ArtImage[];
  logos: ArtImage[];
  chosen: { backdrop: ArtImage | null; logo: ArtImage | null };
  ownKey: boolean;
}

const same = (a: ArtImage | null, b: ArtImage | null) => Boolean(a && b && a.source === b.source && (a.source === "tmdb" ? a.path === b.path : a.url === b.url));
const thumb = (a: ArtImage) => (a.source === "tmdb" ? tmdbImage(a.path, "w300") : (a.previewUrl ?? a.url));

/**
 * "Change picture" (title "More"): the profile's own background and logo for the title's page,
 * from the title's art at TMDB and fanart.tv, or "Lumovio's choice". A pick applies at once and the page behind
 * redraws with it; every profile chooses for itself. Under the grid, an optional fanart.tv key of the person's own.
 */
export function ArtChooser({ kind, tmdbId, title, open, onOpenChange }: { kind: MediaKind; tmdbId: number; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("art");
  const router = useRouter();
  // The key is the account's: a kids profile can't set it, the API refuses it there (requireAccountDevice).
  const kids = Boolean(useSession().me?.activeProfile?.isKids);
  const qc = useQueryClient();
  const key = ["title-art", kind, tmdbId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => api<Choices>(`/api/catalog/title/${kind}/${tmdbId}/art`), enabled: open });
  const [part, setPart] = useState<"backdrop" | "logo">("backdrop");

  const choose = useAction({
    run: (art: ArtImage | null) =>
      api(`/api/catalog/title/${kind}/${tmdbId}/art`, { method: "PUT", json: { part, art: art && { source: art.source, path: art.path, url: art.url } } }),
    optimistic: (art) => {
      const before = qc.getQueryData<Choices>(key);
      qc.setQueryData<Choices>(key, (d) => d && { ...d, chosen: { ...d.chosen, [part]: art } });
      return () => qc.setQueryData(key, before);
    },
    // The page behind shows the pick: that's the confirmation.
    sync: () => router.refresh(),
  });

  const list = q.data ? (part === "backdrop" ? q.data.backdrops : q.data.logos) : [];
  const chosen = q.data?.chosen[part] ?? null;
  const tile = (selected: boolean) =>
    cn("group relative flex w-full flex-col gap-2 rounded-md p-1 text-start text-caption text-text-2", selected && "text-text-1");
  const frame = (selected: boolean, logo: boolean) =>
    cn(
      "relative grid aspect-video w-full place-items-center overflow-hidden rounded-sm",
      logo ? "stage bg-stage p-3" : "bg-surface-2",
      selected ? "ring-2 ring-accent" : "ring-1 ring-line",
    );
  const mark = (
    <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-accent text-on-accent">
      <Check aria-hidden className="size-4" />
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="xl" title={t("title")} description={title}>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label={t("title")}
          value={part}
          onValueChange={setPart}
          options={[
            { value: "backdrop", label: t("background") },
            { value: "logo", label: t("logo") },
          ]}
        />
        <QueryState variant="inline" query={q}>
          {() => (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <li>
                <button /* ui-lint-ignore raw-button: a picture tile (picture + its source), like a profile tile */ type="button" className={tile(!chosen)} aria-pressed={!chosen} onClick={() => void choose.run(null)}>
                  <span className={frame(!chosen, false)}>
                    <Sparkles aria-hidden className="size-6 text-text-2" />
                    {!chosen && mark}
                  </span>
                  {t("auto")}
                </button>
              </li>
              {list.map((a) => {
                const selected = same(a, chosen);
                const src = thumb(a);
                return (
                  <li key={a.path ?? a.url}>
                    <button /* ui-lint-ignore raw-button: a picture tile (picture + its source), like a profile tile */ type="button" className={tile(selected)} aria-pressed={selected} onClick={() => void choose.run(a)}>
                      <span className={frame(selected, part === "logo")}>
                        {/* biome-ignore lint/performance/noImgElement: a thumbnail from TMDB's or fanart.tv's own resizer */}
                        {src && <img src={src} alt="" loading="lazy" className={part === "logo" ? "max-h-full max-w-full object-contain" : "size-full object-cover"} />}
                        {selected && mark}
                      </span>
                      {[a.source === "tmdb" ? "TMDB" : "fanart.tv", a.lang?.toUpperCase()].filter(Boolean).join(" · ")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
        {q.data && list.length === 0 && <EmptyState variant="inline" title={t("empty")} />}
        {q.data && !kids && <FanartKey set={q.data.ownKey} onChanged={() => void qc.invalidateQueries({ queryKey: key })} />}
      </div>
    </Dialog>
  );
}

/** The person's own fanart.tv key (account/fanart-key.ts): newer pictures in the list above. */
function FanartKey({ set, onChanged }: { set: boolean; onChanged: () => void }) {
  const t = useTranslations("art");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = useAction({ run: () => api("/api/preferences/fanart-key", { method: "DELETE" }), success: t("keyRemoved"), sync: onChanged });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const k = value.trim();
    if (!/^[a-f0-9]{32}$/i.test(k)) return setError(t("keyInvalid"));
    setBusy(true);
    setError(null);
    try {
      await api("/api/preferences/fanart-key", { method: "PUT", json: { key: k } });
      setValue("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.issues?.some((i) => i.message === "unknown") ? t("keyUnknown") : tr(apiErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };
  if (set)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-body-s text-text-2">{t("keySet")}</p>
        <Button variant="tertiary" size="sm" disabled={remove.pending} onClick={() => void remove.run()}>
          {tc("remove")}
        </Button>
      </div>
    );
  return (
    <form onSubmit={(e) => void save(e)} noValidate className="flex flex-col gap-3 border-t border-line pt-4">
      <Field
        label={t("keyLabel")}
        hint={
          <>
            {t("keyHint")}{" "}
            <Link variant="inline" href="https://fanart.tv/get-an-api-key/" target="_blank" rel="noopener noreferrer">
              {t("keyGet")}
            </Link>
          </>
        }
        error={error}
      >
        {(id, d, invalid) => (
          <Input
            id={id}
            aria-describedby={d}
            invalid={invalid}
            value={value}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        )}
      </Field>
      <div>
        <Button type="submit" variant="secondary" loading={busy} disabled={!value.trim()}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
