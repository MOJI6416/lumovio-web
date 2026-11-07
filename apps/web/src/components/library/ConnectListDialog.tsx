"use client";

import type { ListSourcePreview, ListSummary } from "@lumovio/contracts";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input } from "@/components/ui/Input";
import { Link } from "@/components/ui/Link";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { apiErrorKey } from "@/lib/api-errors";
import { tmdbImage } from "@/lib/images";

/** Error codes the list-source API answers with, as the person should read them. */
export function sourceErrorKey(err: unknown): "sourceBadUrl" | "sourceNotFound" | "sourceUnavailable" | null {
  if (!(err instanceof ApiRequestError)) return null;
  if (err.code === "bad_request") return "sourceBadUrl";
  if (err.code === "not_found") return "sourceNotFound";
  if (err.code === "upstream_unavailable" || err.code === "not_configured") return "sourceUnavailable";
  return null;
}

/**
 * Follow a public MDBList list: paste its address, see what it holds, then connect. Nothing is
 * created until "Follow this list"; the new list is private and keeps the source's order.
 */
export function ConnectListDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("library");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ListSourcePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "connect" | null>(null);

  const reset = () => {
    setUrl("");
    setPreview(null);
    setError(null);
  };

  const fail = (err: unknown) => {
    const key = sourceErrorKey(err);
    setError(key ? t(key) : tr(apiErrorKey(err)));
  };

  const look = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy("preview");
    setError(null);
    setPreview(null);
    try {
      setPreview(await api<ListSourcePreview>("/api/lists/sources/preview", { method: "POST", json: { url } }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("connect");
    setError(null);
    try {
      const r = await api<{ list: ListSummary; sync: { added: number; skipped: number } | null }>("/api/lists/sources", { method: "POST", json: { url } });
      toast.success(r.sync ? t("sourceConnected", { count: r.sync.added }) : t("sourceConnectedLater"));
      onOpenChange(false);
      reset();
      router.push(`/lists/${r.list.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={t("connectList")}
      // What following does, for a screen reader: the field's example says what to paste (1.2).
      description={<span className="sr-only">{t("connectListHint")}</span>}
    >
      <form onSubmit={look} className="space-y-4">
        <Field label={t("sourceUrl")}>
          {(id) => (
            <Input
              id={id}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(null);
              }}
              placeholder="https://mdblist.com/lists/…"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={400}
              required
              autoFocus
            />
          )}
        </Field>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {!preview && (
          <DialogActions>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={busy === "preview"} disabled={!url.trim()}>
              {t("sourcePreview")}
            </Button>
          </DialogActions>
        )}
      </form>

      {preview && (
        <section className="mt-4 space-y-3 border-t border-line pt-4" aria-live="polite">
          <div>
            <p className="text-title text-text-1">{preview.name}</p>
            <p className="text-body-s text-text-2">
              {[preview.owner && t("sourceBy", { name: preview.owner }), t("sourceTotal", { count: preview.total })].filter(Boolean).join(" · ")}
            </p>
            {preview.description && <p className="mt-1 line-clamp-2 text-body-s text-text-2">{preview.description}</p>}
          </div>
          {preview.sample.length > 0 && (
            <ul className="grid grid-cols-6 gap-1.5" aria-label={t("sourceFirstTitles")}>
              {preview.sample.slice(0, 6).map((s) => (
                <li key={`${s.kind}:${s.tmdbId}`}>
                  {s.posterPath ? (
                    // biome-ignore lint/performance/noImgElement: a 60 px preview poster of TMDB's, no optimisation to gain
                    <img src={tmdbImage(s.posterPath, "w185") ?? undefined} alt={s.year ? `${s.title} (${s.year})` : s.title} loading="lazy" className="aspect-[2/3] w-full rounded-sm bg-surface-2 object-cover" />
                  ) : (
                    <div className="grid aspect-[2/3] w-full place-items-center overflow-hidden break-words rounded-sm bg-surface-2 p-1 text-center text-caption leading-tight text-text-3">{s.title}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* What following keeps and takes, said only where it matters: a list longer than is taken. */}
          <p className="sr-only">
            {preview.dynamic && t("sourceDynamic")} {t("sourceRules")}
          </p>
          {(preview.dynamic || preview.total > preview.limit) && (
            <ul className="space-y-1 text-body-s text-text-2">
              {preview.dynamic && (
                <li className="flex items-center gap-1.5">
                  <RefreshCw aria-hidden className="size-4" />
                  <span className="inline-block first-letter:uppercase">{t("sourceDynamicShort")}</span>
                </li>
              )}
              {preview.total > preview.limit && <li>{t("sourceLimit", { limit: preview.limit })}</li>}
            </ul>
          )}
          {busy === "connect" && (
            <p role="status" className="text-body-s text-text-2">
              {t("sourceConnecting")}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href={preview.url} target="_blank" rel="noreferrer noopener" className="me-auto inline-flex min-h-11 items-center gap-1 text-body-s text-text-2 hover:text-text-1 sm:min-h-8">
              MDBList
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
            {preview.connectedListId ? (
              <Link variant="action" href={`/lists/${preview.connectedListId}`} onClick={() => onOpenChange(false)}>

                {t("sourceAlreadyConnected")}
              </Link>
            ) : (
              <Button onClick={connect} loading={busy === "connect"}>
                {t("sourceConnect")}
              </Button>
            )}
          </div>
        </section>
      )}
    </Dialog>
  );
}
