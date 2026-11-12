/*
 * The TV shell's remote navigation: the screen is made of zones — the menu,
 * the hero, each shelf, a grid, filters, actions, seasons, episodes, a dialog — with explicit neighbours and a memory of
 * the last item. Geometry chooses only inside a zone and as the last resort, so ↓ from a shelf always lands on the next
 * shelf, never on a closer button of another block.
 *
 * Markup (all attributes, so server components can declare zones):
 * - `data-zone="id"` — a zone; `data-zone-axis="x" | "y" | "grid"` (x by default): how its items follow each other.
 * - `data-zone-up|down|left|right="id"` — the neighbour that way; `"none"` stops there. Without one, a zone inside a
 *   `data-zone-group` (a vertical stack; `data-zone-group="x"` for a row of zones) takes the previous or next zone of
 *   the group, else the nearest zone that way on the screen.
 * - `data-zone-entry="first"` — always enter at the first item (filters, actions), not at the remembered one;
 *   `"current"` — at the item with `aria-current` or `aria-pressed` (the menu's section, the chosen season).
 * - `data-zone-scroll="x"` with a `data-zone-track` child — a shelf that slides its track (transform) to keep the item
 *   in view; a `data-tv-scroller` (the page) slides its `data-tv-content` vertically: `data-scroll="pin"` keeps the
 *   focused zone's frame at `data-pin` (a fraction of the height) from the top (the home's shelves), otherwise it scrolls
 *   only as far as needed; `data-zone-frame` marks what has to be in view with a zone (its heading), `="top"` the hero.
 * - `data-key` — a stable identity of an item for memory and Back (a title's id, not its index).
 * - `data-tv-column` — a wrapper whose box stands for its item when ↑/↓ cross between zones (a Top 10's numeral and
 *   poster): the column below is chosen by the whole card, not by the poster beside the numeral.
 * - `data-tv-initial` — the item a screen starts on; `data-tv-initial-pending` marks where it will be while it loads,
 *   and the screen waits for it (up to 4 s) instead of starting elsewhere.
 * Items are any enabled focusable elements; `data-tv-skip` keeps one out (a link inside a card, a hidden slide).
 */

export type Dir = "left" | "right" | "up" | "down";

export const KEY_DIR: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-tv-focus]';

const cap = (d: Dir) => (d.charAt(0).toUpperCase() + d.slice(1)) as "Left" | "Right" | "Up" | "Down";

/** Rendered and not hidden: a zero box, `display: none`, `visibility: hidden`, `inert` or `aria-hidden` subtree. */
export function isUsable(el: HTMLElement): boolean {
  if (el.closest("[inert], [aria-hidden=true], [data-tv-skip]")) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  return getComputedStyle(el).visibility !== "hidden";
}

/** The zone an element belongs to (its nearest one), or null. */
export const zoneOf = (el: Element | null) => (el?.closest("[data-zone]") as HTMLElement | null) ?? null;

/** The items of a zone: its own, not those of a zone nested in it. */
export function itemsOf(zone: HTMLElement): HTMLElement[] {
  return [...zone.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => zoneOf(el) === zone && isUsable(el),
  );
}

/** Every item in `scope`, zoned or not. */
export function itemsIn(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isUsable);
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const rtl = () => document.documentElement.dir === "rtl";

/**
 * The best box in direction `dir` from `from` (pure, for tests): only boxes lying that way count; the distance along
 * the direction plus a penalty for being off the row or column, so a box straight ahead wins over a nearer one aside.
 */
export function nearest<T>(from: Box, list: { box: Box; value: T }[], dir: Dir): T | null {
  const cx = (from.left + from.right) / 2;
  const cy = (from.top + from.bottom) / 2;
  let best: T | null = null;
  let score = Number.POSITIVE_INFINITY;
  for (const { box: r, value } of list) {
    let primary: number;
    let secondary: number;
    if (dir === "right" || dir === "left") {
      if (dir === "right" ? r.left < from.right - 4 : r.right > from.left + 4) continue;
      primary = dir === "right" ? r.left - from.right : from.left - r.right;
      // Overlapping rows are on the same line: no penalty.
      secondary = r.bottom < from.top ? from.top - r.bottom : r.top > from.bottom ? r.top - from.bottom : 0;
      secondary += Math.abs((r.top + r.bottom) / 2 - cy) * 0.1;
    } else {
      if (dir === "down" ? r.top < from.bottom - 4 : r.bottom > from.top + 4) continue;
      primary = dir === "down" ? r.top - from.bottom : from.top - r.bottom;
      secondary = r.right < from.left ? from.left - r.right : r.left > from.right ? r.left - from.right : 0;
      secondary += Math.abs((r.left + r.right) / 2 - cx) * 0.1;
    }
    const s = Math.max(0, primary) + secondary * 3;
    if (s < score) {
      score = s;
      best = value;
    }
  }
  return best;
}

/**
 * The item of a shelf to enter at from another zone (pure): the remembered one when there is one, else the one under
 * the same column (vertical entry) or row (horizontal entry) among those on screen, else the first.
 */
export function entryIndex(
  boxes: Box[],
  from: Box,
  dir: Dir,
  remembered: number,
  viewport: { width: number; height: number },
): number {
  if (remembered >= 0 && remembered < boxes.length) return remembered;
  const vertical = dir === "up" || dir === "down";
  const center = vertical ? (from.left + from.right) / 2 : (from.top + from.bottom) / 2;
  let best = 0;
  let dist = Number.POSITIVE_INFINITY;
  boxes.forEach((b, i) => {
    const onScreen = b.right > 0 && b.left < viewport.width && b.bottom > 0 && b.top < viewport.height;
    if (!onScreen) return;
    const lo = vertical ? b.left : b.top;
    const hi = vertical ? b.right : b.bottom;
    const d = center < lo ? lo - center : center > hi ? center - hi : 0;
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

/** A per-screen memory: the last item of each zone, by its key. */
export class ZoneMemory {
  readonly last = new Map<string, string>();
  remember(el: HTMLElement) {
    const zone = zoneOf(el);
    const key = keyOf(el);
    if (zone?.dataset.zone && key) this.last.set(zone.dataset.zone, key);
  }
}

/** An item's identity: its `data-key`, else its place in the zone. */
export function keyOf(el: HTMLElement): string | null {
  if (el.dataset.key) return el.dataset.key;
  const zone = zoneOf(el);
  if (!zone) return null;
  const i = itemsOf(zone).indexOf(el);
  return i < 0 ? null : `#${i}`;
}

export function findByKey(zone: HTMLElement, key: string): HTMLElement | null {
  const items = itemsOf(zone);
  if (key.startsWith("#")) return items[Number(key.slice(1))] ?? null;
  return items.find((el) => el.dataset.key === key) ?? null;
}

function zoneById(scope: ParentNode, id: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(`[data-zone="${CSS.escape(id)}"]`);
}

/** The zone next to `zone` that way, by its explicit neighbour, its group, or the screen. "none" → null. */
function neighbour(zone: HTMLElement, dir: Dir, scope: HTMLElement): HTMLElement | null | "stop" {
  const named = zone.getAttribute(`data-zone-${dir}`);
  if (named === "none") return "stop";
  if (named) return zoneById(scope, named);
  const group = zone.parentElement?.closest<HTMLElement>("[data-zone-group]");
  if (group && scope.contains(group)) {
    const across = group.dataset.zoneGroup === "x";
    const along = across ? dir === "left" || dir === "right" : dir === "up" || dir === "down";
    if (along) {
      const zones = [...group.querySelectorAll<HTMLElement>("[data-zone]")].filter(
        (z) => z.parentElement?.closest("[data-zone-group]") === group,
      );
      const i = zones.indexOf(zone);
      const forward = across ? (dir === "right") !== rtl() : dir === "down";
      return zones[forward ? i + 1 : i - 1] ?? null;
    }
  }
  return null;
}

/** Every zone in `scope` that way from `zone`, nearest first (the geometric fallback between zones). */
function zonesToward(zone: HTMLElement, dir: Dir, scope: HTMLElement): HTMLElement[] {
  const from = zone.getBoundingClientRect();
  const all = [...scope.querySelectorAll<HTMLElement>("[data-zone]")].filter(
    (z) => z !== zone && !z.contains(zone) && !zone.contains(z),
  );
  const list = all
    .map((z) => ({ box: z.getBoundingClientRect() as Box, value: z }))
    .filter(({ box }) => box.right - box.left > 0 || box.bottom - box.top > 0);
  const out: HTMLElement[] = [];
  let rest = list;
  // Repeatedly the nearest, so an empty zone (a shelf still loading) is stepped over.
  for (let i = 0; i < 4 && rest.length; i++) {
    const z = nearest(from, rest, dir);
    if (!z) break;
    out.push(z);
    rest = rest.filter((x) => x.value !== z);
  }
  return out;
}

export interface MoveResult {
  target: HTMLElement;
  /** The target is in another zone than the start. */
  crossed: boolean;
}

/** Where `dir` leads from `active` inside `scope` (a dialog, or the shell), or null when nothing is that way. */
export function findTarget(
  active: HTMLElement,
  dir: Dir,
  scope: HTMLElement,
  memory: ZoneMemory,
): MoveResult | null {
  const zone = zoneOf(active);
  if (!zone || !scope.contains(zone)) {
    const target = nearest(
      active.getBoundingClientRect(),
      itemsIn(scope)
        .filter((el) => el !== active)
        .map((el) => ({ box: el.getBoundingClientRect() as Box, value: el })),
      dir,
    );
    return target ? { target, crossed: true } : null;
  }

  const items = itemsOf(zone);
  const axis = zone.dataset.zoneAxis ?? "x";
  const i = items.indexOf(active);
  const flip = rtl();
  if (axis === "x" && (dir === "left" || dir === "right")) {
    const next = items[i + ((dir === "right") !== flip ? 1 : -1)];
    if (next) return { target: next, crossed: false };
  } else if (axis === "y" && (dir === "up" || dir === "down")) {
    const next = items[i + (dir === "down" ? 1 : -1)];
    if (next) return { target: next, crossed: false };
  } else if (axis === "grid") {
    const next = nearest(
      active.getBoundingClientRect(),
      items
        .filter((el) => el !== active)
        .map((el) => ({ box: el.getBoundingClientRect() as Box, value: el })),
      dir,
    );
    if (next) return { target: next, crossed: false };
  }

  // Out of the zone: its neighbour that way, stepping over empty zones. From the item's whole column (a Top 10's
  // numeral and poster), so ↓ from the first place lands on the first card below, not the second.
  const from = columnOf(active).getBoundingClientRect();
  let next = neighbour(zone, dir, scope);
  if (next === "stop") return null;
  const tried = new Set<HTMLElement>([zone]);
  const queue: HTMLElement[] = next ? [next] : zonesToward(zone, dir, scope);
  while (queue.length) {
    const z = queue.shift()!;
    if (tried.has(z)) continue;
    tried.add(z);
    const entry = enter(z, from, dir, memory);
    if (entry) return { target: entry, crossed: true };
    next = neighbour(z, dir, scope);
    if (next === "stop") return null;
    if (next) queue.unshift(next);
  }
  return null;
}

/** The item to land on when entering `zone` from `from` going `dir`. */
/** The column an item stands for between shelves: its `data-tv-column` wrapper (a Top 10's numeral and poster), else itself. */
function columnOf(el: HTMLElement): HTMLElement {
  return el.closest<HTMLElement>("[data-tv-column]") ?? el;
}

export function enter(zone: HTMLElement, from: Box, dir: Dir, memory: ZoneMemory): HTMLElement | null {
  const items = itemsOf(zone);
  if (!items.length) return null;
  if (zone.dataset.zoneEntry === "first") return items[0]!;
  if (zone.dataset.zoneEntry === "current") {
    const current = items.find(
      (el) => el.hasAttribute("aria-current") || el.getAttribute("aria-pressed") === "true",
    );
    if (current) return current;
  }
  const key = zone.dataset.zone ? memory.last.get(zone.dataset.zone) : undefined;
  const remembered = key
    ? items.findIndex((el, i) => (key.startsWith("#") ? `#${i}` === key : el.dataset.key === key))
    : -1;
  const boxes = items.map((el) => columnOf(el).getBoundingClientRect() as Box);
  return items[
    entryIndex(boxes, from, dir, remembered, { width: window.innerWidth, height: window.innerHeight })
  ]!;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Current translation of a slid element (its inline transform), in px. */
function shiftOf(el: HTMLElement, axis: "x" | "y"): number {
  const v = el.style.getPropertyValue(axis === "x" ? "--tv-shift-x" : "--tv-shift-y");
  return v ? Number.parseFloat(v) : 0;
}

function setShift(el: HTMLElement, axis: "x" | "y", px: number, animate: boolean) {
  if (!animate || reduced()) el.setAttribute("data-instant", "");
  else el.removeAttribute("data-instant");
  el.style.setProperty(axis === "x" ? "--tv-shift-x" : "--tv-shift-y", `${Math.round(px)}px`);
}

/**
 * `el`'s offset inside `box` from the layout (offsetLeft/Top up the offsetParent chain): unlike its on-screen rectangle
 * it doesn't move while a slide is still running, so a key held down computes from where things will be, not from
 * where an animation happens to be.
 */
function offsetIn(el: HTMLElement, box: HTMLElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== box) {
    left += node.offsetLeft;
    top += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    if (parent && !box.contains(parent) && parent !== box) break;
    node = parent;
  }
  return { left, top };
}

/** Saved slide positions of a screen: the page's and each shelf's (by zone id), for Back. */
export interface Shifts {
  page: number;
  rows: Record<string, number>;
}

export function readShifts(root: ParentNode): Shifts {
  const content = root.querySelector<HTMLElement>("[data-tv-scroller] > [data-tv-content]");
  const rows: Record<string, number> = {};
  for (const track of root.querySelectorAll<HTMLElement>("[data-zone-scroll=x] [data-zone-track]")) {
    const id = zoneOf(track)?.dataset.zone;
    const v = shiftOf(track, "x");
    if (id && v) rows[id] = v;
  }
  return { page: content ? shiftOf(content, "y") : 0, rows };
}

export function applyShifts(root: ParentNode, s: Shifts) {
  const content = root.querySelector<HTMLElement>("[data-tv-scroller] > [data-tv-content]");
  if (content) setShift(content, "y", s.page, false);
  for (const [id, v] of Object.entries(s.rows)) {
    const track = zoneById(root, id)?.querySelector<HTMLElement>("[data-zone-track]");
    if (track) setShift(track, "x", v, false);
  }
}

/**
 * Brings `el` into view: its shelf slides sideways (keeping part of the next card visible on both sides), the page
 * slides vertically. One write per element and a CSS transition that retargets, so a held key never queues animations.
 */
export function reveal(el: HTMLElement, animate = true) {
  const zone = zoneOf(el);
  const track =
    zone?.dataset.zoneScroll === "x" ? zone.querySelector<HTMLElement>("[data-zone-track]") : null;
  if (zone && track) {
    const width = zone.clientWidth;
    const { left } = offsetIn(el, track);
    const right = left + el.offsetWidth;
    const shift = shiftOf(track, "x");
    const peek = Math.min(el.offsetWidth * 0.5, width * 0.08);
    const max = Math.max(0, track.scrollWidth - width);
    let next = shift;
    if (right > shift + width - peek) next = right - width + peek;
    if (left < next + peek) next = left - peek;
    // The first cards stay where the layout put them: no slide before the edge is reached.
    next = Math.min(max, Math.max(0, next));
    if (next !== shift) setShift(track, "x", next, animate);
  }

  const scroller = el.closest<HTMLElement>("[data-tv-scroller]");
  const content = scroller?.querySelector<HTMLElement>(":scope > [data-tv-content]");
  if (!scroller || !content || !content.contains(el)) return;
  const height = scroller.clientHeight;
  const shift = shiftOf(content, "y");
  // What must be in view with the item: its shelf with the heading; in a grid, the card itself.
  const own = el.closest<HTMLElement>("[data-zone-frame]");
  const frame =
    zone?.dataset.zoneAxis === "grid" ? (own && zone.contains(own) ? own : el) : (own ?? zone ?? el);
  const top = offsetIn(frame, content).top;
  const bottom = top + frame.offsetHeight;
  let next = shift;
  if (frame.dataset.zoneFrame === "top") {
    next = 0;
  } else if (scroller.dataset.scroll === "pin") {
    // The home's shelves: the focused shelf always at the same height (its frame's top at `data-pin` of the height).
    next = top - height * (Number(scroller.dataset.pin) || 0);
  } else {
    const margin = height * 0.1;
    if (bottom > shift + height - margin) next = bottom - height + margin;
    if (top < next + margin) next = top - margin;
    next = Math.min(Math.max(0, content.scrollHeight - height), next);
  }
  next = Math.max(0, next);
  if (next !== shift) setShift(content, "y", next, animate);
}
