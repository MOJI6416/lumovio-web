"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { usePlatform } from "@/lib/platform";

const KEY = "lumovio:announcements-closed";
const closedIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/**
 * Announcements over the page (Admin → Management → Announcements): the admin's text in this language for this
 * audience and period; "Hide" keeps one hidden on this device.
 */
export function Announcements() {
  const t = useTranslations("shell");
  const q = usePlatform();
  const [closed, setClosed] = useState<string[] | null>(null);
  useEffect(() => setClosed(closedIds()), []);
  if (!closed || !q.data) return null;
  const shown = q.data.announcements.filter((a) => !closed.includes(a.id));
  if (!shown.length) return null;
  const hide = (id: string) => {
    const next = [...closed, id].slice(-50);
    setClosed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage off: hidden until the page reloads.
    }
  };
  return (
    // On the header's and the pages' gutter and width (5.3), so it starts where the logo does.
    <div className="page-x mx-auto max-w-media space-y-2 bg-bg py-2">
      {shown.map((a) => (
        <InlineAlert
          key={a.id}
          tone={a.tone}
          action={
            <Button variant="tertiary" size="sm" onClick={() => hide(a.id)}>
              {t("announcementHide")}
            </Button>
          }
        >
          {a.text}
        </InlineAlert>
      ))}
    </div>
  );
}
