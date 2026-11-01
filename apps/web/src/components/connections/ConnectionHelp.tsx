"use client";

import type { ProviderKind } from "@lumovio/contracts";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MediaNetError, type NetErrorCode } from "@/lib/media/net";
import { DEFAULT_PORT, diagnosisSteps } from "./connection-help";
import { netErrorText } from "./net-errors";

const KINDS: ProviderKind[] = ["jellyfin", "plex", "torrserver"];
const KIND_LABEL: Record<ProviderKind, string> = { jellyfin: "Jellyfin", plex: "Plex", torrserver: "TorrServer" };

/**
 * What went wrong and what to try, in steps (design-system 7.10 InlineAlert): under the error of the "add server"
 * dialog, and at the top of the help when it is opened from a server that failed its check.
 */
export function Diagnosis({ failure, kind, address, title }: { failure: NetErrorCode; kind: ProviderKind; address: string | null; title?: string }) {
  const t = useTranslations("connectionHelp");
  const tc = useTranslations("connections");
  const steps = diagnosisSteps(failure, kind, address);
  return (
    <InlineAlert tone="danger" title={title}>
      <p>{netErrorText(tc, new MediaNetError(failure, failure), address ?? undefined)}</p>
      <ol className="mt-2 list-decimal space-y-1 ps-5">
        {steps.map((s) => (
          <li key={s}>{t(s as "stepServerOn", { address: address ?? "", command: `tailscale serve --bg ${DEFAULT_PORT[kind]}` })}</li>
        ))}
      </ol>
    </InlineAlert>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-title text-text-1">{title}</h4>
      <div className="flex max-w-measure flex-col gap-2 text-body-s text-text-2">{children}</div>
    </section>
  );
}

/**
 * "Help with connecting" (S19, C132; roadmap Stage 4 onboarding): how Lumovio reaches a server — straight from this
 * device — per server type: its address, Chrome's local network question and how to answer it (and undo a "Block"),
 * when HTTPS is needed and the ways to get it (Tailscale Serve, a reverse proxy, Plex's own addresses), the type's own
 * pitfalls. Opened from a server whose check failed, it starts with what happened and the steps for it, and offers
 * "Check again". A dialog on a computer, a sheet on a phone (7.9); short parts with headings, not a wall of text.
 */
export function ConnectionHelp({
  kind,
  failure,
  server,
  onRetry,
  onClose,
}: {
  /** The server type the help is about; without it the person picks one. */
  kind?: ProviderKind | null;
  failure?: NetErrorCode | null;
  /** The server it was opened from. */
  server?: { name: string; baseUrl: string } | null;
  /** Checks the server again (and closes the help). */
  onRetry?: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("connectionHelp");
  const tc = useTranslations("common");
  const [chosen, setChosen] = useState<ProviderKind>(kind ?? "jellyfin");
  const type = kind ?? chosen;
  const port = DEFAULT_PORT[type];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={server ? t("titleFor", { name: server.name }) : t("title")} description={t("description")} size="lg">
      <div className="flex flex-col gap-6">
        {failure && <Diagnosis failure={failure} kind={type} address={server?.baseUrl ?? null} title={t("whatHappened")} />}
        {!kind && <SegmentedControl label={t("serverType")} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} value={chosen} onValueChange={setChosen} className="self-start" />}
        <Part title={t("addressTitle")}>
          <p>{t(`address_${type}`)}</p>
        </Part>
        <Part title={t("lnaTitle")}>
          <ol className="list-decimal space-y-1 ps-5">
            <li>{t("lnaAsk")}</li>
            <li>{t("lnaBlocked")}</li>
          </ol>
          <p>{t("lnaOthers")}</p>
        </Part>
        <Part title={t("httpsTitle")}>
          <p>{t("httpsWhen")}</p>
          <ul className="list-disc space-y-1 ps-5">
            {type === "plex" ? (
              <li>{t("httpsPlex")}</li>
            ) : (
              <>
                <li>
                  {t.rich("httpsTailscale", {
                    command: `tailscale serve --bg ${port}`,
                    // A command to type: Manrope without ligatures ("--" stays two hyphens, 4.1), no monospace.
                    code: (chunks) => <code className="whitespace-nowrap font-sans text-text-1 [font-variant-ligatures:none]">{chunks}</code>,
                  })}
                </li>
                <li>{t("httpsProxy")}</li>
              </>
            )}
          </ul>
        </Part>
        <Part title={t("tipsTitle")}>
          <p>{t(`tip_${type}`)}</p>
        </Part>
      </div>
      {onRetry && (
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>
            {tc("close")}
          </Button>
          <Button
            onClick={() => {
              onClose();
              onRetry();
            }}
          >
            {t("checkAgain")}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
