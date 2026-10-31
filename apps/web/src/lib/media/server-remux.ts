import { api } from "../api";
import { optional } from "../optional";
import type { MediaFileFacts, PlaybackCapabilities } from "./capabilities";

/*
 * Lumovio's stream preparation service (services/remux; docs/player-compatibility-and-ux-2026-10-23.md P5): for a
 * TorrServer file this browser can't play even rebuilt — an iPhone without Media Source, HEVC or H.264 10-bit where it
 * isn't decoded, VC-1, AVI — the server makes HLS of it with FFmpeg: the video copied when it is H.264 the browser
 * decodes, else H.264; the audio AAC. Used only when the owner turned the service on (the API says so); otherwise such
 * a file goes to another app, as before. Loaded by `torrserver.ts` only for such a file.
 */

let enabled: Promise<boolean> | null = null;

/** Whether the service is on for this person (asked once per page; no answer is "off"). */
export function serverRemuxEnabled(): Promise<boolean> {
  enabled ??= optional(
    api<{ enabled: boolean }>("/api/remux").then((r) => r.enabled),
    false,
  );
  return enabled;
}

export interface ServerRemuxPlan {
  video: "copy" | "h264";
  maxHeight: number;
  channels: 2 | 6;
  hdr: boolean;
}

/**
 * What the service should do with this file here: copy H.264 (8-bit) the browser decodes — into MPEG-TS, which every
 * HLS player takes — else make H.264 at most 1080p (4K encoding is beyond a shared server), HDR tone-mapped to SDR;
 * 5.1 AAC kept from a surround track.
 */
export function serverRemuxPlan(
  caps: PlaybackCapabilities,
  file: MediaFileFacts & { height?: number | null; hdr?: boolean; channels?: number | null },
): ServerRemuxPlan {
  const v = (file.videoCodec ?? "").toLowerCase();
  const copy = (v === "h264" || v === "avc") && !(file.bitDepth && file.bitDepth > 8) && caps.video.h264;
  return {
    video: copy ? "copy" : "h264",
    maxHeight: Math.min(1080, file.height || 1080),
    channels: (file.channels ?? 2) >= 6 ? 6 : 2,
    hdr: !copy && Boolean(file.hdr),
  };
}

export async function serverRemuxSession(body: {
  connectionId: string;
  hash: string;
  fileIndex: number;
  audio: number;
  duration: number;
  plan: ServerRemuxPlan;
}): Promise<string> {
  const { plan, ...rest } = body;
  const r = await api<{ url: string }>("/api/remux/sessions", {
    method: "POST",
    json: { ...rest, video: plan.video, maxHeight: plan.maxHeight, channels: plan.channels, hdr: plan.hdr },
  });
  return r.url;
}
