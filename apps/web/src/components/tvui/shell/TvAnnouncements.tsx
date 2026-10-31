"use client";

import { useEffect, useState } from "react";
import { usePlatform } from "@/lib/platform";

const KEY = "lumovio:announcements-tv-seen";

/**
 * An announcement on a TV (Admin → Management → Announcements, audience TV or everyone): a strip at the bottom that
 * takes no focus and goes by itself after 10 s, once per device — the remote stays with the screen under it.
 */
export function TvAnnouncements() {
  const q = usePlatform();
  const [shown, setShown] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    const list = q.data?.announcements ?? [];
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    } catch {}
    const next = list.find((a) => !seen.includes(a.id));
    if (!next) return;
    setShown(next);
    try {
      localStorage.setItem(KEY, JSON.stringify([...seen, next.id].slice(-50)));
    } catch {}
    const timer = setTimeout(() => setShown(null), 10_000);
    return () => clearTimeout(timer);
  }, [q.data]);
  if (!shown) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-8 z-toast flex justify-center px-16">
      <p className="max-w-240 rounded-md border border-line bg-surface-2 px-8 py-4 text-body text-text-1 shadow-float">{shown.text}</p>
    </div>
  );
}
