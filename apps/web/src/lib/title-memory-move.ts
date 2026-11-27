import { api } from "./api";
import { MEMORY_MOVED } from "./title-memory";

/*
 * The one move of this device's memory by title from the older keys (`<profile>:movie:603`) to the titles' codes,
 * with one request for all of them (`/api/v2/codes`). Loaded only on a device that hasn't moved yet.
 */

const DONE = MEMORY_MOVED;
/** Stores whose keys end with a title: `<profile>:<title>` → value. */
const BY_PROFILE_TITLE = ["lumovio.player.voice", "lumovio.player.subtitles", "lumovio.player.subtitle-offset"];
/** "Searched lately" of each profile (`lumovio.finds.tried:<profile>`): `<title>` → when. */
const TRIED = "lumovio.finds.tried:";
const INTENT = "lumovio:guest-intent";
const OLDER = /^(?:movie|tv):\d+$/;
const BATCH = 200;

const read = (key: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** The title at a key's end: `<profile>:movie:603` → `movie:603`. */
const titleAt = (key: string) => /(?:^|:)((?:movie|tv):\d+)$/.exec(key)?.[1] ?? null;

/** The codes of older keys, as the API knows them. */
const askCodes = async (ids: string[]) => (await api<{ codes: Record<string, string> }>(`/api/v2/codes?ids=${encodeURIComponent(ids.join(","))}`)).codes;

/** The memory's keys in the older form, and the codes they move to (`/api/v2/codes`, unknown ones are left out). */
async function codesOf(keys: string[], ask: (ids: string[]) => Promise<Record<string, string>>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < keys.length; i += BATCH) for (const [k, v] of Object.entries(await ask(keys.slice(i, i + BATCH)))) out.set(k, v);
  return out;
}

/**
 * Moves the older keys of this device's memory to the codes, once: done when every store is moved (a failed request
 * leaves it for the next visit). The order of each store (the newest last) stays.
 */
export async function moveTitleMemory(ask: (ids: string[]) => Promise<Record<string, string>> = askCodes): Promise<void> {
  let storage: Storage;
  try {
    storage = localStorage;
    if (storage.getItem(DONE)) return;
  } catch {
    return;
  }
  const stores = [...BY_PROFILE_TITLE, ...Object.keys(storage).filter((k) => k.startsWith(TRIED))];
  const older = new Set<string>();
  for (const s of stores) for (const k of Object.keys(read(s) ?? {})) if (titleAt(k)) older.add(titleAt(k)!);
  const intent = read(INTENT);
  if (typeof intent?.titleId === "string" && OLDER.test(intent.titleId)) older.add(intent.titleId);
  if (older.size > 0) {
    const codes = await codesOf([...older], ask);
    for (const s of stores) {
      const all = read(s);
      if (!all) continue;
      const moved = Object.fromEntries(
        Object.entries(all).map(([k, v]) => {
          const title = titleAt(k);
          const code = title ? codes.get(title) : undefined;
          return [code ? `${k.slice(0, k.length - title!.length)}${code}` : k, v];
        }),
      );
      storage.setItem(s, JSON.stringify(moved));
    }
    if (intent && typeof intent.titleId === "string" && codes.has(intent.titleId)) storage.setItem(INTENT, JSON.stringify({ ...intent, titleId: codes.get(intent.titleId) }));
  }
  storage.setItem(DONE, "1");
}
