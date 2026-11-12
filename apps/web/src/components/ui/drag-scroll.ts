/** Every sideways scroller of the site: shelves, the episode strip, tabs and chip rows (`.scroll-row`, globals.css). */
const ROW = ".scroll-row";
/** Past this many pixels a press becomes a drag (a click below it stays a click). */
const THRESHOLD = 6;
/** Momentum: the speed left after each 16.7 ms frame, and the speed (px/ms) where it stops. */
const FRICTION = 0.95;
const MIN_SPEED = 0.03;
/** The pointer's last moves that give the speed it is let go at. */
const SAMPLE_MS = 90;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The scroll position whose card start is nearest — where the row's own snapping would put it (LTR rows). */
function snapTarget(el: HTMLElement): number | null {
  if (getComputedStyle(el).direction === "rtl") return null;
  const pad = Number.parseFloat(getComputedStyle(el).scrollPaddingInlineStart) || 0;
  const max = el.scrollWidth - el.clientWidth;
  const origin = el.getBoundingClientRect().left - el.scrollLeft;
  let best: number | null = null;
  for (const child of el.children) {
    const left = Math.min(max, Math.max(0, child.getBoundingClientRect().left - origin - pad));
    if (best === null || Math.abs(left - el.scrollLeft) < Math.abs(best - el.scrollLeft)) best = left;
  }
  return best;
}

/**
 * Drag a row sideways with the mouse: press the left button anywhere in a `.scroll-row` and move.
 * A touch screen already swipes and a TV has its remote, so only a mouse drags. The press doesn't focus the card under
 * it (a focused card would pull the row to itself) and the cards don't react to the pointer while it drags; let go
 * mid-throw and the row glides on, slowing down, then eases onto the nearest card — the row's snapping is off until
 * then, so it never jumps. The click that ends a drag opens nothing; a press that didn't move is an ordinary click.
 * Fields keep their own drag. Installed once by DragScroll (the root layout); returns the uninstall.
 */
export function installDragScroll(): () => void {
  let row: HTMLElement | null = null;
  let pointer = -1;
  let startX = 0;
  let startLeft = 0;
  let dragging = false;
  let samples: { t: number; x: number }[] = [];
  // The row still gliding or settling after a throw, and how to stop it.
  let moving: { el: HTMLElement; stop: () => void } | null = null;

  const release = (el: HTMLElement) => {
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    el.style.pointerEvents = "";
  };
  // Onto the nearest card, then the row snaps by itself again from exactly there.
  const settle = (el: HTMLElement) => {
    const target = snapTarget(el);
    if (target === null || Math.abs(target - el.scrollLeft) < 1) {
      release(el);
      moving = null;
      return;
    }
    el.scrollTo({ left: target, behavior: reduced() ? "auto" : "smooth" });
    const done = () => {
      clearTimeout(timer);
      el.removeEventListener("scrollend", done);
      release(el);
      moving = null;
    };
    const timer = setTimeout(done, 600);
    el.addEventListener("scrollend", done);
    moving = { el, stop: done };
  };
  const glide = (el: HTMLElement, speed: number) => {
    let v = speed;
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const before = el.scrollLeft;
      el.scrollLeft = before - v * dt;
      v *= FRICTION ** (dt / 16.7);
      // Stopped by its speed or by the row's end.
      if (Math.abs(v) < MIN_SPEED || el.scrollLeft === before) {
        settle(el);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    moving = {
      el,
      stop: () => {
        cancelAnimationFrame(frame);
        release(el);
        moving = null;
      },
    };
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const target = e.target as Element;
    const el = target.closest<HTMLElement>(ROW);
    // A press on a gliding row catches it where it is.
    if (moving && (!el || moving.el === el)) moving.stop();
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    if (target.closest("input, textarea, select, [contenteditable=true], [role=slider]")) return;
    row = el;
    pointer = e.pointerId;
    startX = e.clientX;
    startLeft = el.scrollLeft;
    dragging = false;
    samples = [{ t: e.timeStamp, x: e.clientX }];
  };
  // No focus from a mouse press inside a row (a shelf scrolls a focused card into view), no text selection and no
  // drag of a link or a picture; the click still comes, and the keyboard still focuses as before.
  const mouseDown = (e: MouseEvent) => {
    if (row && e.button === 0) e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!row || e.pointerId !== pointer) return;
    const dx = e.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < THRESHOLD) return;
      dragging = true;
      row.style.scrollSnapType = "none";
      row.style.scrollBehavior = "auto";
      // The cards under the pointer don't rise or open their previews while it drags.
      row.style.pointerEvents = "none";
      document.documentElement.style.cursor = "grabbing";
      document.documentElement.style.userSelect = "none";
    }
    // The content follows the pointer, in either direction of the page (scrollLeft is negative in RTL).
    row.scrollLeft = startLeft - dx;
    samples.push({ t: e.timeStamp, x: e.clientX });
    while (samples.length > 2 && e.timeStamp - samples[0]!.t > SAMPLE_MS) samples.shift();
    e.preventDefault();
  };
  const up = (e: PointerEvent) => {
    if (!row || e.pointerId !== pointer) return;
    const el = row;
    row = null;
    if (!dragging) return;
    dragging = false;
    // The cards answer the pointer again at once: a press on the gliding row catches it.
    el.style.pointerEvents = "";
    document.documentElement.style.cursor = "";
    document.documentElement.style.userSelect = "";
    // The speed of the last moves; a pointer that stopped before letting go doesn't throw.
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const span = last.t - first.t;
    const speed = span > 0 && e.timeStamp - last.t < 60 ? (last.x - first.x) / span : 0;
    if (!reduced() && Math.abs(speed) > 0.2) glide(el, speed);
    else settle(el);
    // The click that follows this pointerup in the same task opens nothing; one that never comes is forgotten.
    const swallow = (c: MouseEvent) => {
      c.preventDefault();
      c.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
  };
  // A wheel or a touch takes the row over from a glide.
  const interrupt = (e: Event) => {
    if (moving && (e.target as Element | null)?.closest?.(ROW) === moving.el) moving.stop();
  };

  document.addEventListener("pointerdown", down);
  document.addEventListener("mousedown", mouseDown);
  document.addEventListener("pointermove", move, { passive: false });
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
  document.addEventListener("wheel", interrupt, { passive: true });
  document.addEventListener("touchstart", interrupt, { passive: true });
  return () => {
    moving?.stop();
    document.removeEventListener("pointerdown", down);
    document.removeEventListener("mousedown", mouseDown);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
    document.removeEventListener("wheel", interrupt);
    document.removeEventListener("touchstart", interrupt);
  };
}
