"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Home, Pause, Send, Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
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

type Key = "up" | "down" | "left" | "right" | "ok" | "back" | "home" | "play";
interface TvDevice {
  id: string;
  label: string;
  online: boolean;
  lastSeenAt: string;
}

/**
 * The phone as a remote of the account's TV (TV document §7.3; S56, C64): the arrows, OK, Back, Home and play/pause,
 * and text for the TV's search. Commands go to the chosen TV only and take the TV's own way (the same navigation as its
 * remote). Whether the TV has Lumovio open is said; a command that didn't go is said too, never silently lost.
 */
export function RemoteControl() {
  const t = useTranslations("remote");
  const tn = useTranslations("nav");
  const q = useQuery({ queryKey: ["remote-tvs"], queryFn: () => api<{ devices: TvDevice[] }>("/api/devices/tv"), refetchInterval: 15_000 });
  const [chosen, setChosen] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
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
              text={t("noTvsText")}
              action={
                <Link href="/link" className={buttonClass("primary")}>
                  {tn("linkDevice")}
                </Link>
              }
            />
          );
        const tv = devices.find((d) => d.id === chosen) ?? devices.find((d) => d.online) ?? devices[0]!;
        const send = async (body: { key: Key } | { text: string }) => {
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
        const key = (k: Key, icon: typeof ChevronUp, label: string) => <IconButton icon={icon} label={label} variant="secondary" size="lg" onClick={() => void send({ key: k })} />;
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
          <div className="mx-auto flex max-w-sm flex-col items-center gap-8">
            {devices.length > 1 && (
              // A Select, not a SegmentedControl: the TVs' names are long and there may be many (7.5, 7.6) — three overflowed a phone.
              <Select aria-label={t("which")} options={devices.map((d) => ({ value: d.id, label: d.label }))} value={tv.id} onValueChange={setChosen} className="w-full" />
            )}
            <p className="flex items-center gap-2 text-body text-text-2">
              <Tv aria-hidden className="size-5" />
              <span className="font-semibold text-text-1">{tv.label}</span>
              <span aria-hidden>·</span>
              <span className={tv.online ? "text-success" : "text-text-2"}>{tv.online ? t("online") : t("notOpen")}</span>
            </p>
            <div className="grid grid-cols-3 place-items-center gap-4">
              <span />
              {key("up", ChevronUp, t("up"))}
              <span />
              {key("left", ChevronLeft, t("left"))}
              <Button size="lg" onClick={() => void send({ key: "ok" })}>
                OK
              </Button>
              {key("right", ChevronRight, t("right"))}
              <span />
              {key("down", ChevronDown, t("down"))}
              <span />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={() => void send({ key: "back" })}>
                {t("back")}
              </Button>
              <Button variant="secondary" size="lg" icon={Home} onClick={() => void send({ key: "home" })}>
                {tn("home")}
              </Button>
              <Button variant="secondary" size="lg" icon={Pause} aria-label={t("playPause")} onClick={() => void send({ key: "play" })} />
            </div>
            <form onSubmit={(e) => void submit(e)} className="flex w-full items-end gap-2">
              <Field label={t("textLabel")} className="flex-1">
                {(id, d) => <Input id={id} aria-describedby={d} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} enterKeyHint="send" />}
              </Field>
              <Button type="submit" icon={Send} loading={busy} aria-label={t("sendText")} />
            </form>
            <p role="status" aria-live="polite" className={cn("min-h-6 text-body-s", status?.tone === "error" ? "text-danger" : status?.tone === "warn" ? "text-warning" : "text-text-2")}>
              {status?.text}
            </p>
          </div>
        );
      }}
    </QueryState>
  );
}
