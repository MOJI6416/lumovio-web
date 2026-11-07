"use client";

import type { TvDevice } from "@lumovio/contracts";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, House, Keyboard, type LucideIcon, Play, Send, Tv } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type FormEvent, type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { QueryState } from "@/components/ui/QueryState";
import { Select } from "@/components/ui/Select";
import { Link } from "@/i18n/navigation";
import { ApiRequestError, api } from "@/lib/api";
import { useTvName, useTvs } from "./cast";

// What the TV plays (its live stream, the time, the controls) after the remote itself: it shows only while something
// plays, so it isn't the page's first load (bundle budget).
const CastRemote = dynamic(() => import("./CastRemote").then((m) => m.CastRemote), { ssr: false });

type Key = "up" | "down" | "left" | "right" | "ok" | "back" | "home" | "play";

/** A swipe moves the focus one step every this many pixels (a long swipe — several, as Apple TV's remote). */
const STEP_PX = 56;
/** Shorter than this, and quick, a touch is OK. */
const TAP_PX = 12;
const TAP_MS = 400;

/**
 * The phone as the TV's remote (design-system 8.18, TV document §7.3; S56, C64, C204–C206), from scratch as Apple TV's
 * Remote: which TV and whether Lumovio is open on it; what it plays — the same block as after "Watch on TV" (CastRemote);
 * a touch surface — a swipe is an arrow (a long one several), a touch is OK, its edges and middle are buttons too (a
 * mouse, a keyboard's arrows, a screen reader); under it Back, Home, Play/Pause and Text for the TV's search. Commands
 * take the TV's own way (the same navigation as its remote); one that didn't go is said, never lost silently.
 */
export function RemoteControl() {
  const t = useTranslations("remote");
  const tn = useTranslations("nav");
  const q = useTvs({ refetchInterval: 15_000 });
  const name = useTvName();
  const [chosen, setChosen] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <QueryState query={q} error={{ title: t("loadError") }}>
      {({ devices }) => {
        if (devices.length === 0)
          return (
            <EmptyState
              icon={Tv}
              title={t("noTvs")}
              action={
                <Link href="/link" className={buttonClass("primary")}>
                  {tn("linkDevice")}
                </Link>
              }
            />
          );
        const tv = devices.find((d) => d.id === chosen) ?? devices.find((d) => d.online) ?? devices[0]!;
        const send = async (body: { key: Key } | { text: string }) => {
          // A tick under the finger where the phone has one (Android), as a remote's click.
          navigator.vibrate?.(8);
          try {
            const r = await api<{ ok: boolean; online: boolean }>(`/api/devices/${encodeURIComponent(tv.id)}/remote`, { method: "POST", json: body });
            setStatus(r.online ? null : { tone: "warn", text: t("offline") });
            return true;
          } catch (e) {
            setStatus({ tone: "error", text: e instanceof ApiRequestError && e.status === 404 ? t("gone") : t("notSent") });
            void q.refetch();
            return false;
          }
        };
        const submit = async (e: FormEvent) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          if (await send({ text: text.trim() })) {
            setText("");
            setStatus({ tone: "ok", text: t("textSent") });
          }
          setBusy(false);
        };
        return (
          <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
            <TvLine devices={devices} tv={tv} name={name} onChoose={setChosen} />
            <CastRemote key={tv.id} tv={tv} castId={null} name={name(tv, devices)} framed />
            <TouchPad onKey={(k) => void send({ key: k })} dim={!tv.online} />
            <div className="grid grid-cols-4 gap-2">
              <RemoteKey icon={ArrowLeft} label={t("back")} onClick={() => void send({ key: "back" })} />
              <RemoteKey icon={House} label={tn("home")} onClick={() => void send({ key: "home" })} />
              <RemoteKey icon={Play} label={t("playKey")} name={t("playPause")} onClick={() => void send({ key: "play" })} />
              <RemoteKey icon={Keyboard} label={t("text")} pressed={typing} onClick={() => setTyping((v) => !v)} />
            </div>
            {typing && (
              <form onSubmit={(e) => void submit(e)} className="flex w-full items-end gap-2">
                <Field label={t("textLabel")} className="flex-1">
                  {(id, d) => <Input id={id} aria-describedby={d} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} enterKeyHint="send" autoFocus />}
                </Field>
                <Button type="submit" icon={Send} loading={busy} aria-label={t("sendText")} />
              </form>
            )}
            <p role="status" aria-live="polite" className={cn("min-h-6 text-center text-body-s", status?.tone === "error" ? "text-danger" : status?.tone === "warn" ? "text-warning" : "text-text-2")}>
              {status?.text}
            </p>
          </div>
        );
      }}
    </QueryState>
  );
}

/** Which TV, and whether Lumovio is open on it: a Select for several (their names are long, 7.5), the name for one. */
function TvLine({ devices, tv, name, onChoose }: { devices: TvDevice[]; tv: TvDevice; name: ReturnType<typeof useTvName>; onChoose: (id: string) => void }) {
  const t = useTranslations("remote");
  const state = (
    <span className={cn("flex shrink-0 items-center gap-1.5 text-body-s", tv.online ? "text-success" : "text-text-2")}>
      <span aria-hidden className={cn("size-2 rounded-full", tv.online ? "bg-success" : "bg-text-3")} />
      {tv.online ? t("online") : t("notOpen")}
    </span>
  );
  if (devices.length > 1)
    return (
      <div className="flex flex-col gap-2">
        <Select aria-label={t("which")} options={devices.map((d) => ({ value: d.id, label: name(d, devices) }))} value={tv.id} onValueChange={onChoose} className="w-full" />
        {state}
      </div>
    );
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-title text-text-1">
        <Tv aria-hidden className="size-5 shrink-0" />
        <span className="truncate">{name(tv, devices)}</span>
      </p>
      {state}
    </div>
  );
}

/**
 * The touch surface: a swipe is an arrow — one per 56 px of it, so a long swipe goes several steps — a quick touch is
 * OK. The arrows at its edges and OK in its middle are buttons too, for a mouse, a keyboard (its arrows work on the
 * whole surface) and a screen reader. The step taken lights its arrow for a moment. `dim`: Lumovio isn't open on the TV.
 */
function TouchPad({ onKey, dim }: { onKey: (k: Key) => void; dim: boolean }) {
  const t = useTranslations("remote");
  const touch = useRef<{ x: number; y: number; lx: number; ly: number; at: number; moved: boolean; onButton: boolean } | null>(null);
  // A swipe that started on a button of the surface isn't its press.
  const swiped = useRef(false);
  const [lit, setLit] = useState<Key | null>(null);
  const litTimer = useRef<number | undefined>(undefined);
  const press = (k: Key) => {
    onKey(k);
    setLit(k);
    window.clearTimeout(litTimer.current);
    litTimer.current = window.setTimeout(() => setLit(null), 180);
  };
  const dirOf = (dx: number, dy: number): Key => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  // The whole surface swipes, its buttons too (as Apple TV's); a button is pressed by a touch that stayed put.
  const down = (e: PointerEvent<HTMLFieldSetElement>) => {
    swiped.current = false;
    const onButton = Boolean((e.target as Element).closest("button"));
    // On a button the pointer stays its own, so its click comes; elsewhere the surface keeps it past its edges.
    if (!onButton) e.currentTarget.setPointerCapture(e.pointerId);
    touch.current = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, at: performance.now(), moved: false, onButton };
  };
  const move = (e: PointerEvent<HTMLFieldSetElement>) => {
    const s = touch.current;
    if (!s) return;
    const dx = e.clientX - s.lx;
    const dy = e.clientY - s.ly;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < STEP_PX) return;
    press(dirOf(dx, dy));
    s.lx = e.clientX;
    s.ly = e.clientY;
    s.moved = true;
  };
  const up = (e: PointerEvent<HTMLFieldSetElement>) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const far = Math.max(Math.abs(dx), Math.abs(dy));
    if (s.moved || far >= TAP_PX * 2) swiped.current = true;
    if (s.moved) return;
    // A short swipe is one step; a quick touch that stayed put is OK (on a button — that button's own press).
    if (far >= TAP_PX * 2) press(dirOf(dx, dy));
    else if (!s.onButton && far < TAP_PX && performance.now() - s.at < TAP_MS) press("ok");
  };
  const tap = (k: Key) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    press(k);
  };
  const keys: Record<string, Key> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const onKeyDown = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    const k = keys[e.key];
    if (!k) return;
    e.preventDefault();
    press(document.documentElement.dir === "rtl" && (k === "left" || k === "right") ? (k === "left" ? "right" : "left") : k);
  };
  // The arrows quiet at the edges (--text-2); the step just taken lit for a moment.
  const edge = (k: Key, icon: LucideIcon, label: string, where: string) => (
    <IconButton icon={icon} label={label} size="lg" onClick={() => tap(k)} className={cn("absolute", lit === k ? "[&>span]:bg-surface-3" : "[&>span]:text-text-2", where)} />
  );
  return (
    // A fieldset is the group of its arrows and OK, with the surface's gestures and its keyboard arrows on it; the square
    // is the block inside (a fieldset doesn't take an aspect ratio).
    <fieldset
      aria-label={t("pad")}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => (touch.current = null)}
      onKeyDown={onKeyDown}
      className="m-0 min-w-0 border-0 p-0"
    >
      <div className={cn("relative aspect-square w-full touch-none select-none rounded-lg bg-surface-1 transition-opacity duration-base", dim && "opacity-60")}>
      {edge("up", ChevronUp, t("up"), "start-1/2 top-2 -translate-x-1/2 rtl:translate-x-1/2")}
      {edge("down", ChevronDown, t("down"), "bottom-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2")}
      {edge("left", ChevronLeft, t("left"), "start-2 top-1/2 -translate-y-1/2")}
      {edge("right", ChevronRight, t("right"), "end-2 top-1/2 -translate-y-1/2")}
      <Button variant="secondary" size="lg" onClick={() => tap("ok")} className={cn("absolute start-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 px-0 text-title rtl:translate-x-1/2", lit === "ok" && "bg-surface-3")}>
        OK
      </Button>
      </div>
    </fieldset>
  );
}

/**
 * A remote's key under the surface: a `secondary` circle (IconButton, a toggle's state as `pressed`) with its name under
 * it — a remote's keys are read by their names. `name`: the full name when the caption is short ("Play/Pause").
 */
function RemoteKey({ icon, label, name, onClick, pressed }: { icon: LucideIcon; label: string; name?: string; onClick: () => void; pressed?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <IconButton icon={icon} label={name ?? label} variant="secondary" size="lg" pressed={pressed} onClick={onClick} />
      <span aria-hidden className="max-w-full text-center text-body-s leading-tight text-text-2 [overflow-wrap:anywhere]">
        {label}
      </span>
    </div>
  );
}
