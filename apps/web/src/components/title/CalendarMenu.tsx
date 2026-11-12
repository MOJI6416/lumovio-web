"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarPlus, Download, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import { GuestGate } from "@/components/shell/GuestGate";
import { Button } from "@/components/ui/Button";
import { Menu, MenuCheckboxItem, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import type { CalendarButtonLook } from "./AddToCalendar";
import type { TitleCore } from "./core";

/**
 * The calendar's menu (a sheet on a phone). First Lumovio's own calendar, a switch: a film is there by "Watchlist", a
 * series by its new-episode alerts — what puts a title on that calendar anyway, so the switch and "+" / "Notify me of
 * new episodes" are one state. Its toast opens the calendar. Then the calendars elsewhere: Google Calendar's form,
 * filled in, in a new tab; or the event as a file — Safari on an iPhone or a Mac shows it to add, a computer's browser
 * downloads it for Outlook and the others. The API makes both from the title, in the page's language.
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
  const router = useRouter();
  const qc = useQueryClient();
  const a = usePersonalActions(d);
  const [open, setOpen] = useState(initialOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);

  const film = d.kind === "movie";
  // The same query and request as "More" → "Notify me of new episodes", so both show one state.
  const follow = useQuery({
    queryKey: ["follow", d.id],
    queryFn: () => api<{ following: boolean }>(`/api/follow/${d.id}`),
    enabled: a.signedIn && !film,
  });
  const setFollow = useAction({
    run: (on: boolean) => api("/api/follow", { method: "POST", json: { titleId: d.id, on } }),
    optimistic: (on) => {
      qc.setQueryData(["follow", d.id], { following: on });
      return () => qc.setQueryData(["follow", d.id], { following: !on });
    },
  });
  const onCalendar = film ? a.inWatchlist : Boolean(follow.data?.following);
  const added = (message: string) => toast.success(message, { action: { label: t("openCalendar"), onClick: () => router.push("/calendar") } });
  const toggle = async (on: boolean) => {
    if (film) {
      // A guest is asked to sign in, and the title goes on "Watchlist" afterwards.
      if ((await a.setWatchlist(on))?.ok && on) added(t("calendarAddedFilm", { title: d.title }));
      return;
    }
    if (!a.signedIn) return a.requireAuth("follow", "follow");
    if ((await setFollow.run(on)).ok && on) added(t("followOn", { title: d.title }));
  };

  const event = `/api/catalog/title/${d.kind}/${d.tmdbId}/calendar?lang=${encodeURIComponent(locale)}`;
  return (
    <>
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
        <MenuCheckboxItem icon={CalendarCheck} checked={onCalendar} disabled={a.busy === "wl" || setFollow.pending} onCheckedChange={(on) => void toggle(on)}>
          <span className="block">{t("calendarLumovio")}</span>
          <span className="block text-body-s text-text-2">{film ? t("calendarViaWatchlist") : t("calendarViaFollow")}</span>
        </MenuCheckboxItem>
        <MenuSeparator />
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
      <GuestGate {...a.gate} />
    </>
  );
}
