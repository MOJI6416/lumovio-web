"use client";

import type { CastAnswer, CastControl, CastFailure, CastRequest, TvDevice } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useSession } from "@/components/providers/Providers";
import { api } from "@/lib/api";

/*
 * "Watch on TV" on the phone and the computer (design-system 8.18): which TVs of the account have Lumovio open, sending
 * a viewing to one, and the remote of that viewing. The TV opens it in its player (tvui/shell/TvEvents) and says what it
 * plays (./cast-report); the API checks every step on the server.
 */

/** The account's TVs; the remote (./RemoteControl) shares the query. */
export const TVS_KEY = ["devices", "tv"] as const;

/** What a place sends: the viewing as it is there, with its name for the remote. */
export interface CastTarget extends Omit<CastRequest, "switchProfile"> {
  title: string;
  /** "Season 1, episode 2 · Pilot", a film's year. */
  subtitle: string | null;
}

/**
 * The account's TVs for a signed-in profile on the site (never in the TV shell, never for a guest). Asked again once a
 * minute while the page is shown and when it comes back, so a TV that opens Lumovio brings the button.
 */
export function useTvs(opts: { refetchInterval?: number } = {}) {
  const { me, tv } = useSession();
  return useQuery({
    queryKey: TVS_KEY,
    queryFn: () => api<{ devices: TvDevice[] }>("/api/devices/tv"),
    enabled: Boolean(me?.activeProfile) && !tv,
    staleTime: 20_000,
    refetchInterval: opts.refetchInterval ?? 60_000,
    retry: false,
  });
}

/** The TVs a viewing can be sent to now: Lumovio open on them. */
export const onlineTvs = (devices: TvDevice[] | undefined) => (devices ?? []).filter((d) => d.online);

/** Sends the viewing; `switchProfile` once the person said to switch the TV to their profile. */
export const sendCast = (tvId: string, target: CastTarget, switchProfile = false) => {
  const { title: _title, subtitle: _subtitle, ...rest } = target;
  return api<CastAnswer>(`/api/devices/${encodeURIComponent(tvId)}/cast`, { method: "POST", json: { ...rest, switchProfile } });
};

export const controlTv = (tvId: string, c: CastControl) => api<{ ok: boolean; online: boolean }>(`/api/devices/${encodeURIComponent(tvId)}/playback`, { method: "POST", json: c });

/** A TV in the interface language: "TV · Android", one of two the same with its number. */
export function useTvName() {
  const ts = useTranslations("settings");
  return useCallback(
    (tv: TvDevice, all: TvDevice[] = [tv]) => {
      const parts = [tv.device.browser, tv.device.os].filter(Boolean).join(" · ");
      const name = parts ? ts("deviceTv", { device: parts }) : ts("deviceTvOnly");
      const same = all.filter((x) => x.device.browser === tv.device.browser && x.device.os === tv.device.os);
      return same.length > 1 ? `${name} ${same.indexOf(tv) + 1}` : name;
    },
    [ts],
  );
}

/** Why the TV didn't start it, in words (the TV's own failure, `CastFailure`). */
export const FAILURE_KEYS: Record<CastFailure, string> = {
  blocked: "fail_blocked",
  unreachable: "fail_unreachable",
  auth: "fail_auth",
  missing: "fail_missing",
  none: "fail_none",
  unsupported: "fail_unsupported",
  external: "fail_external",
  other: "fail_other",
};
