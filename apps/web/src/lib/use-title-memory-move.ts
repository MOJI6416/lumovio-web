import { useEffect } from "react";
import { MEMORY_MOVED } from "./title-memory";

/**
 * Moves this device's memory to the codes once, a second after a page that reads it opens (the title's "Where to
 * watch", the player): the move's code loads only on a device that hasn't moved yet.
 */
export function useTitleMemoryMove() {
  useEffect(() => {
    try {
      if (localStorage.getItem(MEMORY_MOVED)) return;
    } catch {
      return;
    }
    const run = () => void import("./title-memory-move").then((m) => m.moveTitleMemory()).catch(() => {}); // ui-lint-ignore swallowed-error: housekeeping; a failed move is tried again on the next visit, unsaid
    const timer = setTimeout(run, 1_000);
    return () => clearTimeout(timer);
  }, []);
}
