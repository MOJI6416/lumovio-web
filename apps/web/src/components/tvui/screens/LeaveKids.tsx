"use client";

import type {
  LeaveCodeSent,
  Profile,
  ProfileApprovalRequest,
  ProfileApprovalState,
} from "@lumovio/contracts";
import { Mail, RefreshCw, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { codeSendErrorText, profileErrorText } from "@/components/profiles/profile-errors";
import { TvButton } from "@/components/ui/tv/TvButton";
import { api } from "@/lib/api";
import { TvLayer } from "../nav/TvLayer";
import { NumPad } from "../shell/NumPad";
import { formatClock } from "@/lib/format";
import { qrImage } from "@/lib/qr";

type Mode =
  | { kind: "approve" }
  | { kind: "mail"; sent: boolean; value: string; error: string | null; busy: boolean };

/**
 * Leaving a kids profile for an adult one without a PIN, on a TV (design-system 8.10, TV document §7.1 item 5): an adult
 * approves it on a phone or a computer of the account — the QR opens the confirmation there, or the code is typed at
 * lumovio.app/link —, and the TV switches by itself; or a 6-digit code mailed to the account is typed with the remote.
 * Never the account password. The rule is the server's (modules/profiles/approval.ts, leave-code.ts).
 */
export function LeaveKids({
  from,
  to,
  onClose,
  onDone,
  onCode,
}: {
  from: { name: string };
  to: Pick<Profile, "id" | "name">;
  onClose: () => void;
  onDone: () => void;
  /** Switches with a mailed code: the refusal, or null once it switched. */
  onCode: (code: string) => Promise<unknown>;
}) {
  const t = useTranslations("profiles");
  const tv = useTranslations("tvui");
  const [mode, setMode] = useState<Mode>({ kind: "approve" });
  const [request, setRequest] = useState<ProfileApprovalRequest | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<ProfileApprovalState | "loading" | "error" | "expired">("loading");
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const ask = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await api<ProfileApprovalRequest>("/api/profiles/select/approval", {
        method: "POST",
        json: { profileId: to.id },
      });
      setRequest(r);
      setDeadline(Date.now() + r.expiresIn * 1000);
      setQr(await qrImage(r.url, 360));
      setStatus("pending");
    } catch {
      setStatus("error");
    }
  }, [to.id]);

  useEffect(() => {
    void ask();
  }, [ask]);

  // Asked every 3 s while waiting; the time left every second.
  useEffect(() => {
    if (status !== "pending" || mode.kind !== "approve") return;
    const poll = window.setInterval(async () => {
      if (Date.now() > deadline) return setStatus("expired");
      try {
        const r = await api<{ status: ProfileApprovalState }>("/api/profiles/select/approval");
        if (r.status === "approved") onDone();
        else if (r.status === "denied") setStatus("denied");
        else if (r.status === "none") setStatus("expired");
      } catch {
        // A lost poll: the next one asks again; the code stays on the screen.
      }
    }, 3000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [status, mode.kind, deadline, onDone]);

  const sendMail = async () => {
    setMode({ kind: "mail", sent: false, value: "", error: null, busy: true });
    try {
      await api<LeaveCodeSent>("/api/profiles/select/code", { method: "POST", json: { profileId: to.id } });
      setMode({ kind: "mail", sent: true, value: "", error: null, busy: false });
    } catch (e) {
      setMode({ kind: "mail", sent: false, value: "", error: codeSendErrorText(t, e), busy: false });
    }
  };

  const display = request?.code.replace(/^(.{4})(.{4})$/, "$1-$2");
  const address = request ? new URL(request.url).host + new URL(request.url).pathname : "";
  const line =
    status === "pending"
      ? tv("approveWaiting", { time: formatClock(Math.ceil((deadline - now) / 1000)) })
      : status === "denied"
        ? tv("approveDenied")
        : status === "expired"
          ? tv("approveExpired")
          : status === "error"
            ? tv("approveError")
            : "";

  return (
    <TvLayer look="screen" label={tv("leaveKidsTitle", { name: to.name })} onClose={onClose}>
      {() => (
        <div className="stage flex h-full flex-col justify-center gap-10 bg-stage px-(--gutter)">
          <div className="flex flex-col gap-3">
            <h2 className="text-h1 text-text-1">{tv("leaveKidsTitle", { name: to.name })}</h2>
            <p className="max-w-measure text-body-l text-text-2">
              {tv("leaveKidsText", { kids: from.name, name: to.name })}
            </p>
          </div>
          {mode.kind === "approve" ? (
            <div className="flex items-center gap-14">
              <div className="shrink-0 rounded-md bg-white p-4">
                {qr && status === "pending" ? (
                  <img src={qr} alt={tv("approveQr")} className="size-64" />
                ) : (
                  <div aria-hidden className="size-64" />
                )}
              </div>
              <div className="flex flex-col gap-5">
                <p className="flex items-center gap-3 text-body-l text-text-2">
                  <Smartphone aria-hidden className="size-7 shrink-0" />
                  {tv("approveHow", { url: address || "lumovio.app/link" })}
                </p>
                <p className="text-display font-extrabold tracking-widest text-text-1 tabular-nums">
                  {status === "pending" ? display : "····-····"}
                </p>
                <p role="status" className="text-body-l text-text-2 tabular-nums">
                  {line}
                </p>
                <div data-zone="leave" data-zone-axis="x" className="flex flex-wrap gap-4">
                  {status !== "pending" && status !== "loading" && (
                    <TvButton icon={RefreshCw} data-tv-initial onClick={() => void ask()}>
                      {tv("approveAgain")}
                    </TvButton>
                  )}
                  <TvButton
                    icon={Mail}
                    data-tv-initial={status === "pending" || undefined}
                    onClick={() => void sendMail()}
                  >
                    {t("useCode")}
                  </TvButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-14">
              <div className="flex max-w-150 flex-col gap-4">
                <p className="text-body-l text-text-2">
                  {mode.sent ? t("codeSent") : mode.busy ? tv("sendingCode") : (mode.error ?? "")}
                </p>
                <div data-zone="leave" data-zone-axis="x" className="flex flex-wrap gap-4">
                  <TvButton icon={Smartphone} onClick={() => setMode({ kind: "approve" })}>
                    {tv("approveInstead")}
                  </TvButton>
                  {!mode.busy && !mode.sent && (
                    <TvButton icon={RefreshCw} data-tv-initial onClick={() => void sendMail()}>
                      {t("sendCode")}
                    </TvButton>
                  )}
                </div>
              </div>
              {mode.sent && (
                <div className="flex flex-col items-center gap-4">
                  <NumPad
                    label={t("codeLabel")}
                    value={mode.value}
                    onChange={(value) => setMode({ ...mode, value, error: null })}
                    onDone={async () => {
                      setMode({ ...mode, busy: true });
                      const e = await onCode(mode.value);
                      if (e)
                        setMode({ ...mode, value: "", busy: false, error: profileErrorText(t, e, "code") });
                    }}
                    min={6}
                    max={6}
                    busy={mode.busy}
                  />
                  <p role="alert" className="min-h-8 text-body-l font-semibold text-danger">
                    {mode.error}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </TvLayer>
  );
}
