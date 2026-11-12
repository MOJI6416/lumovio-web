"use client";

import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/shell/Wordmark";
import { TvButton } from "@/components/ui/tv/TvButton";
import { formatClock } from "@/lib/format";
import { qrImage } from "@/lib/qr";

interface CodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

type State = "loading" | "waiting" | "offline" | "expired" | "denied" | "error";

/**
 * Signing in on a TV: a big one-time code, the QR that opens the confirmation on a phone
 * with the code filled in, the short address for typing it on a computer, how long the code lives. The TV asks every
 * 5 s whether it was approved; a lost connection is said and retried, never an endless spinner; an expired or refused
 * code gets "Get a new code" with the focus on it. Approved → "Who's watching?", keeping the address the TV was opened
 * with (`next`).
 */
/**
 * `appAddress`: an Android TV's browser is told about the app — the short address to type into Downloader.
 */
export function PairScreen({ next, appAddress }: { next: string; appAddress?: string | null }) {
  const t = useTranslations("tv");
  const tv = useTranslations("tvui");
  const locale = useLocale();
  const [code, setCode] = useState<CodeResponse | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<State>("loading");
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<number | null>(null);
  const newCode = useRef<HTMLButtonElement>(null);

  const start = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    setState("loading");
    try {
      const res = await fetch("/api/auth/device/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: "lumovio-tv" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const c = (await res.json()) as CodeResponse;
      setCode(c);
      setQr(await qrImage(c.verification_uri_complete));
      const end = Date.now() + c.expires_in * 1000;
      setDeadline(end);
      setState("waiting");
      const every = Math.max(5, c.interval) * 1000 + 300;
      const poll = async () => {
        if (Date.now() > end) return setState("expired");
        try {
          const r = await fetch("/api/auth/tv/poll", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ device_code: c.device_code }),
            credentials: "same-origin",
          });
          const body = (await r.json()) as { status: string };
          if (body.status === "approved") {
            const q = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
            window.location.href = `${locale === "en" ? "" : `/${locale}`}/profiles${q}`;
            return;
          }
          if (body.status === "denied") return setState("denied");
          if (body.status === "expired") return setState("expired");
          setState("waiting");
        } catch {
          // No connection: said on the screen; the code stays and the next poll tries again.
          setState("offline");
        }
        timer.current = window.setTimeout(poll, every);
      };
      timer.current = window.setTimeout(poll, every);
    } catch {
      setState("error");
    }
  }, [locale, next]);

  useEffect(() => {
    void start();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [start]);

  // The time left, once a second, while the code is shown.
  useEffect(() => {
    if (state !== "waiting" && state !== "offline") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const dead = state === "expired" || state === "denied" || state === "error";
  useEffect(() => {
    if (dead) newCode.current?.focus({ preventScroll: true });
  }, [dead]);

  const display = code?.user_code.replace(/^(.{4})(.{4})$/, "$1-$2");
  const address = code
    ? `${new URL(code.verification_uri).host}${new URL(code.verification_uri).pathname}`
    : "";
  const status =
    state === "waiting"
      ? tv("pairExpires", { time: formatClock(Math.ceil((deadline - now) / 1000)) })
      : state === "offline"
        ? tv("pairOffline")
        : state === "denied"
          ? t("denied")
          : state === "expired"
            ? t("expired")
            : state === "error"
              ? t("pairError")
              : "";

  return (
    <div
      data-tv-screen="home"
      data-tv-main
      className="stage grid h-full place-items-center bg-stage px-(--gutter)"
    >
      <div className="flex w-full max-w-300 items-center justify-between gap-16">
        <div className="flex max-w-170 flex-col gap-6">
          <Wordmark className="h-10 w-auto text-text-1" />
          <h1 className="text-h1 text-text-1">{t("pairTitle")}</h1>
          <ol className="flex list-inside list-decimal flex-col gap-2 text-body-l text-text-2">
            <li>{tv("pairStep1")}</li>
            <li>{tv("pairStep2", { url: address || "lumovio.app/link" })}</li>
          </ol>
          {/* The code in the interface font with even figures and spacing (no monospace). */}
          <p className="text-display font-extrabold tracking-widest text-text-1 tabular-nums" aria-live="polite">
            <span aria-hidden>{state === "loading" ? "····-····" : display}</span>
            {code && <span className="sr-only">{tv("pairCodeLabel", { code: code.user_code.split("").join(" ") })}</span>}
          </p>
          <p
            role="status"
            className={
              state === "waiting"
                ? "text-body-l text-text-2 tabular-nums"
                : "text-body-l font-semibold text-text-1"
            }
          >
            {status}
          </p>
          <div data-zone="pair" data-zone-axis="x" className="flex gap-4">
            <TvButton
              ref={newCode}
              icon={RefreshCw}
              data-tv-initial
              onClick={() => void start()}
              loading={state === "loading"}
            >
              {t("newCode")}
            </TvButton>
          </div>
          {appAddress && <p className="text-body-l text-text-2">{tv("appHint", { address: appAddress })}</p>}
        </div>
        {/* The QR code keeps its white plate in both themes. */}
        <div className="shrink-0 rounded-md bg-white p-5">
          {qr && state !== "expired" && state !== "denied" ? (
            <img src={qr} alt={tv("pairQr")} className="size-80" />
          ) : (
            <div aria-hidden className="size-80" />
          )}
        </div>
      </div>
    </div>
  );
}
