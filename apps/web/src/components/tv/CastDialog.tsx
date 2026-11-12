"use client";

import type { TvDevice } from "@lumovio/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SettingsLink } from "@/components/ui/Settings";
import { ApiRequestError } from "@/lib/api";
import { type CastTarget, onlineTvs, sendCast, TVS_KEY, useTvName, useTvs } from "./cast";
import { CastRemote } from "./CastRemote";

type Step =
  | { kind: "choose" }
  | { kind: "confirm"; tv: TvDevice; profile: { name: string; isKids: boolean } | null }
  | { kind: "sending"; tv: TvDevice }
  | { kind: "remote"; tv: TvDevice; castId: string | null }
  | { kind: "error"; tv: TvDevice | null; text: string };

/**
 * "Watch on TV": one dialog (a sheet on a phone) from the choice to the remote.
 * Several TVs open — which one (its profile under its name); the TV on another profile — "Switch … to …?" first, never
 * silently; then the remote of that viewing on the TV (CastRemote). A refusal says why, with the way to try again.
 * `mode: "remote"` — the TV already plays this: straight to its remote.
 */
export default function CastDialog({
  target,
  start,
  onClose,
  onSent,
}: {
  target: () => CastTarget;
  start: { mode: "send" } | { mode: "remote"; tvId: string };
  onClose: () => void;
  /** The phone's own player pauses once the TV has it. */
  onSent?: () => void;
}) {
  const t = useTranslations("cast");
  const tc = useTranslations("common");
  const { me } = useSession();
  const qc = useQueryClient();
  const tvs = useTvs();
  const devices = tvs.data?.devices ?? [];
  const online = onlineTvs(devices);
  const name = useTvName();
  const [step, setStep] = useState<Step>(() => {
    if (start.mode === "remote") {
      const tv = devices.find((d) => d.id === start.tvId);
      if (tv) return { kind: "remote", tv, castId: null };
    }
    return { kind: "choose" };
  });
  // What was sent: the remote names it until the TV says what it plays.
  const sent = useRef<CastTarget | null>(null);

  const send = useCallback(
    async (tv: TvDevice, switchProfile = false) => {
      const what = target();
      sent.current = what;
      setStep({ kind: "sending", tv });
      try {
        const r = await sendCast(tv.id, what, switchProfile);
        if (r.status === "sent") {
          setStep({ kind: "remote", tv, castId: r.castId });
          onSent?.();
          // The TV's profile may have changed (its name under the TV in the list).
          if (r.switched) void qc.invalidateQueries({ queryKey: TVS_KEY });
        } else if (r.status === "profile") setStep({ kind: "confirm", tv, profile: r.profile });
        else if (r.status === "locked") setStep({ kind: "error", tv, text: t("locked", { profile: r.profile.name }) });
        else {
          setStep({ kind: "error", tv, text: t("offline") });
          void qc.invalidateQueries({ queryKey: TVS_KEY });
        }
      } catch (e) {
        const text = e instanceof ApiRequestError && (e.code === "maturity_blocked" || e.code === "title_unavailable") ? t("notAllowed") : e instanceof ApiRequestError && e.status === 404 ? t("gone") : t("notSent");
        setStep({ kind: "error", tv, text });
        void qc.invalidateQueries({ queryKey: TVS_KEY });
      }
    },
    [target, onSent, qc, t],
  );

  // One TV open, in this profile: sent at once, as the button promised; otherwise the choice comes first.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || start.mode !== "send" || !tvs.data) return;
    auto.current = true;
    const only = online.length === 1 ? online[0]! : null;
    if (only) void send(only);
  }, [start.mode, tvs.data, online, send]);

  const title = step.kind === "remote" || step.kind === "sending" ? (sent.current?.title ?? step.tv.playback?.title ?? t("button")) : step.kind === "confirm" ? t("switchTitle", { profile: me?.activeProfile?.name ?? "" }) : t("button");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} description={step.kind === "remote" || step.kind === "sending" ? (sent.current?.subtitle ?? undefined) : undefined} size="sm">
      {step.kind === "choose" &&
        (online.length === 0 ? (
          <p className="text-body text-text-2">{t("noneOpen")}</p>
        ) : (
          // The TVs as the settings' rows: the name, the profile under it when it isn't yours; a press sends.
          <ul className="flex flex-col divide-y divide-line">
            {online.map((tv) => {
              const other = tv.profile && tv.profile.id !== me?.activeProfile?.id ? tv.profile.name : null;
              return (
                <li key={tv.id}>
                  <SettingsLink
                    label={name(tv, devices)}
                    detail={other ? t("onProfile", { name: other }) : undefined}
                    leading={
                      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-surface-2 text-text-1">
                        <Tv className="size-5" />
                      </span>
                    }
                    onClick={() => void send(tv)}
                  />
                </li>
              );
            })}
          </ul>
        ))}

      {step.kind === "confirm" && (
        <>
          <p className="text-body text-text-2">
            {step.profile && t(step.profile.isKids ? "switchTextKids" : "switchText", { current: step.profile.name })}
          </p>
          <DialogActions>
            <Button variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => void send(step.tv, true)}>{t("switchConfirm")}</Button>
          </DialogActions>
        </>
      )}

      {step.kind === "sending" && <CastRemote tv={step.tv} castId={null} sending name={name(step.tv, devices)} />}
      {step.kind === "remote" && <CastRemote tv={step.tv} castId={step.castId} name={name(step.tv, devices)} onResend={sent.current ? () => void send(step.tv) : undefined} full />}

      {step.kind === "error" && (
        <>
          <InlineAlert tone="danger">{step.text}</InlineAlert>
          {step.tv && (
            <DialogActions>
              <Button variant="secondary" onClick={onClose}>
                {tc("cancel")}
              </Button>
              <Button onClick={() => void send(step.tv!)}>{t("sendAgain")}</Button>
            </DialogActions>
          )}
        </>
      )}
    </Dialog>
  );
}
