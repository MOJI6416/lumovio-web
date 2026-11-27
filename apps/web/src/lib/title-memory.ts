/*
 * What this device remembers by title — the audio picked for it, the subtitles and their timing, the titles the home
 * page searched releases for, a guest's action to finish after signing in — is kept under the title's own code; a title
 * without one in its answer, under its older key (`movie:603`). Memory older versions wrote under the older keys moves
 * to the codes once (use-title-memory-move.ts).
 */

/** The key a title is remembered by on this device. */
export const memoryId = (t: { code?: string | null; id: string }): string => t.code ?? t.id;

/** Set once this device's memory is on the codes. */
export const MEMORY_MOVED = "lumovio.memory.codes";
