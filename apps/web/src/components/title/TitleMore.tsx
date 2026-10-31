"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CircleCheck, Ellipsis, EyeOff, Heart, ListPlus, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CreateListDialog } from "@/components/library/CreateListDialog";
import { ListPicker } from "@/components/media/ListPicker";
import { NotInterestedDialog } from "@/components/media/NotInterestedDialog";
import { usePersonalActions } from "@/components/media/usePersonalActions";
import { GuestGate } from "@/components/shell/GuestGate";
import { IconButton } from "@/components/ui/IconButton";
import { usePhoneLayout } from "@/components/ui/layers";
import { Menu, MenuCheckboxItem, MenuItem } from "@/components/ui/Menu";
import { useSetLibraryState } from "@/hooks/useLibraryState";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { randomId } from "@/lib/random-id";
import type { TitleLibraryState } from "@lumovio/contracts";
import { isOngoing, type TitleCore } from "./core";
import { HeroAction } from "./HeroAction";

/**
 * The title hero's "More" (design-system 8.1, TTL-02, TTL-08, TTL-09, TTL-20, TTL-24): Favourites, Watched (a series:
 * all of it, exactly undone), Not interested, Add to list… (the list picker with "New list"), new-episode alerts for a
 * series that still gets them (saying where they arrive), Share (the system sheet, else the link copied). The same
 * requests, toasts and Undo as a card's "More" (media/usePersonalActions). Loaded by TitleActions when approached.
 */
export function TitleMore({ title: d, initialOpen, focusTrigger, label }: { title: TitleCore; initialOpen: boolean; focusTrigger: boolean; label: string }) {
  const t = useTranslations("titlePage");
  const tc = useTranslations("card");
  const a = usePersonalActions(d);
  const qc = useQueryClient();
  const setState = useSetLibraryState();
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(initialOpen);
  const [listsOpen, setListsOpen] = useState(false);
  const [newList, setNewList] = useState(false);
  const [hiding, setHiding] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when it takes the light button's place
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, []);

  const ongoing = isOngoing(d);
  const follow = useQuery({
    queryKey: ["follow", d.id],
    queryFn: () => api<{ following: boolean }>(`/api/follow/${d.id}`),
    enabled: a.signedIn && ongoing,
  });
  const followRequest = (on: boolean) => api("/api/follow", { method: "POST", json: { titleId: d.id, on } });
  const setFollow = useAction({
    run: (on: boolean) => followRequest(on),
    optimistic: (on) => {
      qc.setQueryData(["follow", d.id], { following: on });
      return () => qc.setQueryData(["follow", d.id], { following: !on });
    },
    // Where the alerts arrive is said when they are switched on (TTL-20); off needs no toast.
    success: (_r, on) => (on ? t("followOn", { title: d.title }) : null),
    undo: () => followRequest(false),
  });

  // A whole series at once, taken back exactly: only what this mark added goes again (TTL-25).
  const markShow = useAction({
    run: async (undoKey: string) => {
      const s = await api<TitleLibraryState>("/api/history/mark", { method: "POST", json: { titleId: d.id, scope: "show", watched: true, undoKey } });
      setState(s);
      return s;
    },
    success: () => t("showMarked"),
    undo: async (_s, undoKey) => setState(await api<TitleLibraryState>("/api/history/mark/undo", { method: "POST", json: { undoKey } })),
  });

  const movie = d.kind === "movie";
  const triggerEl = phone ? (
    <HeroAction ref={trigger}>
      <Ellipsis aria-hidden />
      {label}
    </HeroAction>
  ) : (
    <IconButton ref={trigger} icon={Ellipsis} variant="secondary" size="lg" label={label} />
  );

  return (
    <>
      <Menu open={open} onOpenChange={setOpen} label={label} title={d.title} align="start" trigger={triggerEl}>
        <MenuCheckboxItem icon={Heart} checked={a.isFavorite} onCheckedChange={(on) => void a.setFavorite(on)}>
          {tc("favorite")}
        </MenuCheckboxItem>
        {movie ? (
          <MenuCheckboxItem icon={CircleCheck} checked={a.watched} onCheckedChange={(on) => void a.setWatched(on)}>
            {tc("watched")}
          </MenuCheckboxItem>
        ) : (
          <MenuItem icon={CircleCheck} disabled={markShow.pending} onSelect={() => (a.signedIn ? void markShow.run(randomId()) : a.requireAuth("watched"))}>
            {t("markShow")}
          </MenuItem>
        )}
        {/* Guests have no recommendations to keep a title out of. Marking asks why (optional), as on a card; taking it back doesn't. */}
        {a.signedIn && (
          <MenuCheckboxItem icon={EyeOff} checked={a.hidden} onCheckedChange={(on) => (on ? setHiding(true) : void a.setHidden(false))}>
            {tc("notInterested")}
          </MenuCheckboxItem>
        )}
        <MenuItem icon={ListPlus} onSelect={() => (a.signedIn ? setListsOpen(true) : a.requireAuth("list"))}>
          {tc("addToList")}
        </MenuItem>
        {ongoing &&
          (a.signedIn ? (
            <MenuCheckboxItem icon={Bell} checked={Boolean(follow.data?.following)} disabled={setFollow.pending || follow.isPending} onCheckedChange={(on) => void setFollow.run(on)}>
              <span className="block">{t("follow")}</span>
              <span className="block text-body-s text-text-2">{t("followWhere")}</span>
            </MenuCheckboxItem>
          ) : (
            <MenuItem icon={Bell} onSelect={() => a.requireAuth("follow", "follow")}>
              {t("follow")}
            </MenuItem>
          ))}
        <MenuItem icon={Share2} onSelect={() => void a.share()}>
          {tc("share")}
        </MenuItem>
      </Menu>
      <GuestGate {...a.gate} />
      {a.signedIn && (
        <ListPicker
          open={listsOpen}
          onOpenChange={setListsOpen}
          title={d.title}
          actions={a}
          onNew={() => {
            setListsOpen(false);
            setNewList(true);
          }}
        />
      )}
      {a.signedIn && <CreateListDialog open={newList} onOpenChange={setNewList} onCreated={a.addToNewList} />}
      {a.signedIn && (
        <NotInterestedDialog open={hiding} onOpenChange={setHiding} title={d.title} genreIds={d.genreIds} onConfirm={(reason) => void a.setHidden(true, undefined, reason)} />
      )}
    </>
  );
}
