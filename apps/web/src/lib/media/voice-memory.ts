/**
 * The audio a profile picked for a title, kept on this device: a track chosen in the player, or the audio a release was
 * chosen with on the sources screen ("<language>|<studio or kind>", as `voiceKeys` names options). The title's next
 * episodes, its next visit and "Where to watch" start it, ahead of the profile's order of languages and studios, until
 * another is picked. Keyed `<profile>:<title>` as the subtitles' choice (subs/choice); the latest 200 titles.
 */

const KEY = "lumovio.player.voice";
const KEEP = 200;

const listeners = new Set<() => void>();

export const voiceMemoryKey = (profileId: string | null | undefined, titleId: string) => `${profileId ?? "guest"}:${titleId}`;

export function loadVoice(key: string): string | null {
  try {
    const v = (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>)[key];
    return typeof v === "string" && v.includes("|") ? v : null;
  } catch {
    return null;
  }
}

export function saveVoice(key: string, voice: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    delete all[key];
    all[key] = voice;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete all[k];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the choice holds for this playback only.
  }
  for (const l of listeners) l();
}

export function subscribeVoice(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
