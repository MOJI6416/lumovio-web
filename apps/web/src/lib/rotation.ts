/**
 * Time a carousel slide has been on screen while rotation was running. Pausing freezes it and
 * resuming continues from there, so a hover never starts the slide's interval over. The timer
 * that advances the slide and the progress bar both read this one clock.
 */
export class SlideClock {
  private elapsed = 0;
  private since: number | null = null;

  constructor(readonly interval: number) {}

  /** A new slide gets a full interval of its own. */
  reset(): void {
    this.elapsed = 0;
    this.since = null;
  }

  resume(now: number): void {
    if (this.since === null) this.since = now;
  }

  pause(now: number): void {
    if (this.since === null) return;
    this.elapsed += now - this.since;
    this.since = null;
  }

  shown(now: number): number {
    return this.elapsed + (this.since === null ? 0 : now - this.since);
  }

  remaining(now: number): number {
    return Math.max(0, this.interval - this.shown(now));
  }

  progress(now: number): number {
    return Math.min(1, this.shown(now) / this.interval);
  }
}

/** Independent reasons to hold the rotation; any one of them stops it, and each is cleared on its own. */
export interface HoldReasons {
  /** The pause button. */
  paused: boolean;
  /** A mouse or pen over the carousel. */
  hover: boolean;
  /** Keyboard focus inside the carousel. */
  focus: boolean;
  /** The tab is not visible. */
  hidden: boolean;
  /** prefers-reduced-motion: nothing moves on its own. */
  reduced: boolean;
}

export function rotates(slides: number, r: HoldReasons): boolean {
  return slides > 1 && !r.paused && !r.hover && !r.focus && !r.hidden && !r.reduced;
}
