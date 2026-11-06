"use client";

import { useEffect } from "react";

/** Every sideways scroller of the site: shelves, the episode strip, tabs and chip rows (`.scroll-row`, globals.css). */
const ROW = ".scroll-row";
/** Past this many pixels a press becomes a drag (a click below it stays a click). */
const THRESHOLD = 6;

/**
 * Drag a row sideways with the mouse (owner, 2026-11-06): press the left button anywhere in a `.scroll-row` and move.
 * A touch screen already swipes and a TV has its remote, so only a mouse drags. While dragging the row doesn't snap and
 * nothing gets selected; letting go snaps it again, and the click that ends a drag opens nothing — a press that didn't
 * move is an ordinary click. Fields keep their own drag. Mounted once, in the root layout.
 */
export function DragScroll() {
  useEffect(() => {
    let row: HTMLElement | null = null;
    let pointer = -1;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const target = e.target as Element;
      const el = target.closest<HTMLElement>(ROW);
      if (!el || el.scrollWidth <= el.clientWidth + 1) return;
      if (target.closest("input, textarea, select, [contenteditable=true], [role=slider]")) return;
      row = el;
      pointer = e.pointerId;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      dragging = false;
    };
    const move = (e: PointerEvent) => {
      if (!row || e.pointerId !== pointer) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD) return;
        dragging = true;
        row.style.scrollSnapType = "none";
        row.style.scrollBehavior = "auto";
        row.style.cursor = "grabbing";
        document.documentElement.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
      }
      // The content follows the pointer, in either direction of the page (scrollLeft is negative in RTL).
      row.scrollLeft = startLeft - dx;
      e.preventDefault();
    };
    const up = (e: PointerEvent) => {
      if (!row || e.pointerId !== pointer) return;
      const el = row;
      row = null;
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "";
      document.documentElement.style.userSelect = "";
      // Snapping again from where it was let go.
      requestAnimationFrame(() => {
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
      });
      // The click that follows this pointerup in the same task opens nothing; one that never comes is forgotten.
      const swallow = (c: MouseEvent) => {
        c.preventDefault();
        c.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };
    // A link's or a picture's own drag (to the bookmarks bar) would take the pointer away from the row.
    const nativeDrag = (e: DragEvent) => {
      if ((e.target as Element | null)?.closest?.(ROW)) e.preventDefault();
    };

    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    document.addEventListener("dragstart", nativeDrag);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.removeEventListener("dragstart", nativeDrag);
    };
  }, []);
  return null;
}
