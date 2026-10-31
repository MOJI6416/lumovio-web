"use client";

import { Bookmark, CircleCheck, CircleHelp, Ellipsis, EyeOff, Heart, Info, ListPlus, Share2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CreateListDialog } from "@/components/library/CreateListDialog";
import { GuestGate, type GuestIntent } from "@/components/shell/GuestGate";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuCheckboxItem, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { titleHref } from "@/lib/slug";
import { ListPicker } from "./ListPicker";
import { NotInterestedDialog } from "./NotInterestedDialog";
import { useShelf } from "./shelf-context";
import { type ActionTitle, usePersonalActions } from "./usePersonalActions";
import { WhyDialog } from "./WhyDialog";

/**
 * What a card's menu adds for its shelf: "Remove from Continue watching" (with Undo), "More info" where the card plays,
 * and on personal shelves "Why this?" with the lines of the pick's reason.
 */
export interface CardMenuExtra {
  remove?: { label: string; run: () => void };
  details?: boolean;
  why?: string[];
}

/**
 * A card's "More" menu (design-system 8.1, 7.12): the personal actions with the same requests, toasts and Undo as the
 * title page (./usePersonalActions) — Watchlist, Favourites, Watched (a series: its episodes on the title page),
 * Not interested (asks why, optionally; the card leaves a shelf at once; Undo brings it back), Why this? (personal
 * shelves), Add to list…, Share. On a phone it opens as a
 * sheet (ui/Menu). A guest gets the sign-in sheet for the action and it is done after signing in. Loaded by
 * ./CardMore when needed.
 */
export function CardMenu({
  title,
  initialOpen = false,
  focusTrigger = false,
  openSignal = 0,
  replay,
  extra,
  className,
}: {
  title: ActionTitle & { genreIds?: number[] };
  initialOpen?: boolean;
  focusTrigger?: boolean;
  openSignal?: number;
  replay?: GuestIntent["action"] | null;
  extra?: CardMenuExtra;
  className?: string;
}) {
  const t = useTranslations("card");
  const a = usePersonalActions(title);
  const shelf = useShelf();
  const [open, setOpen] = useState(initialOpen);
  const [listsOpen, setListsOpen] = useState(false);
  const [newList, setNewList] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [why, setWhy] = useState(false);
  const href = titleHref(title.kind, title.tmdbId, title.title);

  // A long press after the menu arrived.
  const signal = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== signal.current) {
      signal.current = openSignal;
      if (openSignal) setOpen(true);
    }
  }, [openSignal]);
  // What a guest pressed on this card before signing in, once the card's state is known.
  const replayed = useRef(false);
  useEffect(() => {
    if (!replay || replayed.current || !a.signedIn || a.state === undefined) return;
    replayed.current = true;
    a.replay(replay);
  });

  const movie = title.kind === "movie";
  return (
    <>
      <Menu
        open={open}
        onOpenChange={setOpen}
        label={t("menu")}
        title={title.title}
        trigger={
          <IconButton
            icon={Ellipsis}
            variant="stage"
            size="sm"
            label={t("more", { title: title.title })}
            autoFocus={focusTrigger}
            className={className}
          />
        }
      >
        {extra?.details && (
          <MenuItem icon={Info} href={href}>
            {t("details")}
          </MenuItem>
        )}
        <MenuCheckboxItem icon={Bookmark} checked={a.inWatchlist} onCheckedChange={(on) => void a.setWatchlist(on)}>
          {t("watchlist")}
        </MenuCheckboxItem>
        <MenuCheckboxItem icon={Heart} checked={a.isFavorite} onCheckedChange={(on) => void a.setFavorite(on)}>
          {t("favorite")}
        </MenuCheckboxItem>
        {movie ? (
          <MenuCheckboxItem icon={CircleCheck} checked={a.watched} onCheckedChange={(on) => void a.setWatched(on)}>
            {t("watched")}
          </MenuCheckboxItem>
        ) : (
          // A series is marked episode by episode, or a season at once, on its page (C12).
          <MenuItem icon={CircleCheck} href={`${href}#episodes`}>
            {t("markEpisodes")}
          </MenuItem>
        )}
        {/* Guests have no recommendations to keep a title out of. Marking asks why (optional); taking it back doesn't. */}
        {a.signedIn && (
          <MenuCheckboxItem icon={EyeOff} checked={a.hidden} onCheckedChange={(on) => (on ? setHiding(true) : void a.setHidden(false))}>
            {t("notInterested")}
          </MenuCheckboxItem>
        )}
        {extra?.why && extra.why.length > 0 && (
          <MenuItem icon={CircleHelp} onSelect={() => setWhy(true)}>
            {t("why")}
          </MenuItem>
        )}
        <MenuItem icon={ListPlus} onSelect={() => (a.signedIn ? setListsOpen(true) : a.requireAuth("list"))}>
          {t("addToList")}
        </MenuItem>
        <MenuItem icon={Share2} onSelect={() => void a.share()}>
          {t("share")}
        </MenuItem>
        {extra?.remove && (
          <>
            <MenuSeparator />
            <MenuItem icon={X} onSelect={extra.remove.run}>
              {extra.remove.label}
            </MenuItem>
          </>
        )}
      </Menu>
      <GuestGate {...a.gate} />
      {a.signedIn && (
        <NotInterestedDialog
          open={hiding}
          onOpenChange={setHiding}
          title={title.title}
          genreIds={title.genreIds}
          onConfirm={(reason) => void a.setHidden(true, shelf ? () => shelf.dismiss(title.id) : undefined, reason)}
        />
      )}
      {extra?.why && <WhyDialog open={why} onOpenChange={setWhy} title={title.title} lines={extra.why} />}
      {a.signedIn && (
        <ListPicker
          open={listsOpen}
          onOpenChange={setListsOpen}
          title={title.title}
          actions={a}
          onNew={() => {
            setListsOpen(false);
            setNewList(true);
          }}
        />
      )}
      {a.signedIn && <CreateListDialog open={newList} onOpenChange={setNewList} onCreated={a.addToNewList} />}
    </>
  );
}
