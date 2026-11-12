/**
 * What a rebuilt playback's failure was, by its words (the media element's message, or the rebuild engine's own):
 * - "browser": what this browser can't do — no Media Source, a codec or an audio track the rebuild can't make here.
 *   Repeating can't help.
 * - "data": what was read didn't parse — Media Source refusing a fragment (Chromium's chunk demuxer, Firefox's demuxer)
 *   or the engine's reader (Mediabunny's "Invalid …"). A torrent's piece can reach the player before its check (a
 *   TorrServer's fast reading mode) and come damaged; read again, it is whole.
 * - "other": anything else — a decoder that gave up, the engine itself.
 */
export type RemuxFailure = "browser" | "data" | "other";

const BROWSER = /can't rebuild|no Media Source|unsupported|not supported/i;
const DATA = /DEMUXER|APPEND_FAILED|COULD_NOT_PARSE|^Invalid\b/i;

export function remuxFailure(message: string): RemuxFailure {
  if (BROWSER.test(message)) return "browser";
  return DATA.test(message) ? "data" : "other";
}

/** How long a quiet retry counts: failing again within it, the failure is said; later, it is another place, retried too. */
export const QUIET_RETRY_MS = 180_000;

/**
 * Whether a rebuilt playback that failed is started again at once, reading the file anew, without an error screen:
 * once, unless the browser can't do it at all. `lastRetry`: when this source was last retried so.
 */
export const retriesQuietly = (failure: RemuxFailure, lastRetry: number | undefined, now: number) =>
  failure !== "browser" && (lastRetry === undefined || now - lastRetry >= QUIET_RETRY_MS);
