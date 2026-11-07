"use client";

import { useEffect } from "react";

/**
 * Drag a row sideways with the mouse (ui/drag-scroll). Mounted once, in the root layout; its handlers load right after
 * the page instead of riding in every route's first-load JS (bundle budget).
 */
export function DragScroll() {
  useEffect(() => {
    let uninstall: (() => void) | undefined;
    let gone = false;
    void import("./drag-scroll").then((m) => {
      if (!gone) uninstall = m.installDragScroll();
    });
    return () => {
      gone = true;
      uninstall?.();
    };
  }, []);
  return null;
}
