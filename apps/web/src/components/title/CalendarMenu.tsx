"use client";

import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem } from "@/components/ui/Menu";
import type { CalendarButtonLook } from "./AddToCalendar";
import type { TitleCore } from "./core";

/**
 * The calendar's menu (a sheet on a phone): Google Calendar's form, filled in, in a new tab; or the event as a file —
 * Safari on an iPhone or a Mac shows it to add, a computer's browser downloads it for Outlook and the others. The API
 * makes both from the title, in the page's language.
 */
export function CalendarMenu({
  title: d,
  variant,
  size,
  label,
  initialOpen,
  focusTrigger,
}: { title: TitleCore; label: string; initialOpen: boolean; focusTrigger: boolean } & CalendarButtonLook) {
  const t = useTranslations("titlePage");
  const locale = useLocale();
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);
  const event = `/api/catalog/title/${d.kind}/${d.tmdbId}/calendar?lang=${encodeURIComponent(locale)}`;
  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      label={label}
      title={d.title}
      align="start"
      trigger={
        <Button ref={trigger} variant={variant} size={size} icon={CalendarPlus}>
          {label}
        </Button>
      }
    >
      <MenuItem icon={ExternalLink} onSelect={() => window.open(`${event}&to=google`, "_blank", "noopener")}>
        {t("calendarGoogle")}
      </MenuItem>
      <MenuItem
        icon={Download}
        onSelect={() => {
          window.location.href = `${event}&to=ics`;
        }}
      >
        {t("calendarOther")}
      </MenuItem>
    </Menu>
  );
}
