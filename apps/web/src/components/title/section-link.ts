"use client";

/** Brings a section of the title's page into view (without motion when reduced motion is asked for). */
export function scrollToSection(id: string) {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
}
