/**
 * Shelves of a page reached by a client-side navigation are drawn in turns:
 * the ones on or near the screen at once, the rest — top first — one per idle moment after the page has shown, or as
 * soon as one comes within a screen of the viewport. Drawing a home or catalog page's 400–600 cards in one task held a
 * mid-range Android phone for 0.6–0.9 s after every tap. A page from the server is hydrated whole (Row).
 */
type Nav = EventTarget & { currentEntry?: { key: string; url: string | null } | null };
type NavigateEvent = Event & { navigationType: string; destination: { url: string } };

// Where each history entry was scrolled when it was left (Navigation API's "navigate" fires on the entry being left).
// Back and Forward restore that place before the shelves are laid out: the ones there are then drawn at once, not left
// empty for the first frames — after iOS's swipe back they flickered against the swipe's snapshot.
const left = new Map<string, number>();
const nav = typeof window === "undefined" ? undefined : (window as Window & { navigation?: Nav }).navigation;
nav?.addEventListener("navigate", (event) => {
  const e = event as NavigateEvent;
  const key = nav.currentEntry?.key;
  if (!key) return;
  // The router's own replace of the same address after Back comes before the scroll is restored: not a leaving. Another
  // page in this entry's place (an up-link, useGoUp) leaves nothing to come back to.
  if (e.navigationType === "replace") {
    if (e.destination.url !== nav.currentEntry?.url) left.delete(key);
    return;
  }
  left.set(key, window.scrollY);
});

/** Where Back or Forward will scroll this page — the place its history entry was left at; null on a new page. */
export function restoredScrollY(): number | null {
  const key = nav?.currentEntry?.key;
  return (key ? left.get(key) : undefined) ?? null;
}

type Turn = { el: Element; draw: () => void };

const waiting: Turn[] = [];
let pending = false;
let near: IntersectionObserver | null = null;

// Only when the page is really idle: a tap that leaves it (or anything else) goes first. A shelf coming near the screen
// doesn't wait for that (IntersectionObserver below).
const later = (fn: () => void) => {
  if ("requestIdleCallback" in window) requestIdleCallback(fn);
  else setTimeout(fn, 32);
};

const take = (turn: Turn) => {
  const i = waiting.indexOf(turn);
  if (i < 0) return;
  waiting.splice(i, 1);
  near?.unobserve(turn.el);
  turn.draw();
};

function next() {
  pending = false;
  // The highest shelf on the page first.
  const first = waiting.reduce<Turn | undefined>((a, b) => (!a || b.el.compareDocumentPosition(a.el) & Node.DOCUMENT_POSITION_FOLLOWING ? b : a), undefined);
  if (first) take(first);
  if (waiting.length) schedule();
}

function schedule() {
  if (pending) return;
  pending = true;
  later(next);
}

/** Queues a shelf's drawing; returns the cleanup (the shelf left before its turn). */
export function drawInTurn(el: Element, draw: () => void): () => void {
  const turn = { el, draw };
  near ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const t = e.isIntersecting ? waiting.find((w) => w.el === e.target) : undefined;
        if (t) take(t);
      }
    },
    { rootMargin: "100% 0px" },
  );
  waiting.push(turn);
  near.observe(el);
  schedule();
  return () => {
    const i = waiting.indexOf(turn);
    if (i >= 0) waiting.splice(i, 1);
    near?.unobserve(el);
  };
}
