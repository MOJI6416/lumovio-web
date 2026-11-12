import { api } from "./api";

/*
 * The player's diagnostics (anonymous, for the admin's playback numbers) — and the last of them kept in this browser,
 * so a support request can attach it when the person agrees. No title, no address.
 */

/** The body of /api/playback/diagnostics (contracts' PlaybackDiagnostic). */
interface Diagnostic {
  provider: "jellyfin" | "plex" | "torrserver";
  method: "direct" | "remux" | "transcode" | "external";
  outcome: "started" | "failed" | "fallback";
  errorCode: string | null;
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  platform: string;
  /** A start's time to the first frame. */
  ttffMs?: number;
}

export interface LastPlayback {
  at: string;
  provider: string;
  method: string;
  outcome: string;
  errorCode: string | null;
  platform: string | null;
}

const KEY = "lumovio:last-playback";

/** Sends a playback diagnostic and remembers a failure or a fallback as this browser's last. */
export function reportPlayback(d: Diagnostic) {
  try {
    if (d.outcome !== "started") {
      const last: LastPlayback = { at: new Date().toISOString(), provider: d.provider, method: d.method, outcome: d.outcome, errorCode: d.errorCode, platform: d.platform };
      localStorage.setItem(KEY, JSON.stringify(last));
    }
  } catch {
    // Storage off (a private window): the summary simply has no playback.
  }
  return api("/api/playback/diagnostics", { method: "POST", json: d });
}

export function lastPlayback(): LastPlayback | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as LastPlayback) : null;
  } catch {
    return null;
  }
}
