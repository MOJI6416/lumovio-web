"use client";

import { Check, type LucideIcon } from "lucide-react";
import { DropdownMenu as DM } from "radix-ui";
import { createContext, type ReactNode, useContext, useRef } from "react";
import { Link as IntlLink } from "@/i18n/navigation";
import { cn } from "./cn";
import { Sheet } from "./Dialog";
import { focusBack, isLayerBackKey, rememberLayerTrigger, useOpenState, usePhoneLayout } from "./layers";
import { useOnStage, usePortalContainer } from "./portal";

/*
 * Menu (design-system 7.8): one look for every menu — "More" on a card or a title, the account menu, a server row.
 * Radix DropdownMenu on a tablet and desktop (arrows, typeahead, Escape, focus back to the trigger); on a phone the
 * same items open as a bottom sheet with 52 px rows. Destructive items go last, after a MenuSeparator,
 * with `tone="danger"`. An item that switches a state is a MenuCheckboxItem (a check on the end shows it).
 */

type Mode = { sheet: false } | { sheet: true; close: () => void };
const MenuMode = createContext<Mode>({ sheet: false });

// 40 px rows (on TV 66), the icon in --text-2; the ring of the keyboard and remote sits inside the row (10.3).
const ITEM =
  "relative flex min-h-10 cursor-pointer select-none items-center gap-3 rounded-sm px-3 py-2 text-start text-body text-text-1 transition-colors duration-fast ease-fast focus-visible:-outline-offset-3 data-highlighted:bg-surface-3 data-disabled:cursor-not-allowed data-disabled:opacity-40 in-data-[tv=1]:min-h-12";
const SHEET_ITEM =
  "flex min-h-13 w-full items-center gap-4 rounded-sm px-3 py-3 text-start text-body text-text-1 transition-colors duration-fast ease-fast hover:bg-surface-2 focus-visible:-outline-offset-3 active:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";
const DANGER = "text-danger data-highlighted:bg-danger-soft";
const LABEL = "px-3 pt-2 pb-1 text-body-s font-semibold text-text-2";

export interface MenuProps {
  /** The control that opens the menu: an IconButton "More" or a Button. */
  trigger: ReactNode;
  /** What the menu is about; the heading of the sheet on a phone (unless `title`). */
  label: string;
  /** A more specific sheet heading, such as the title's name. */
  title?: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * A panel rather than a list (the account menu, "Language and theme"; 7.19): 320 wide with the dialogs' radius and
   * room inside, for faces (MenuFaces) and rows without icons.
   */
  panel?: boolean;
}

export function Menu({
  trigger,
  label,
  title,
  children,
  align = "end",
  side = "bottom",
  open: openProp,
  onOpenChange,
  panel = false,
}: MenuProps) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const container = usePortalContainer();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Opened from a stage (the player, a hero): the menu is dark there in either theme (3.5).
  const stage = useOnStage(open && !phone, triggerRef);
  if (phone) {
    return (
      <Sheet open={open} onOpenChange={setOpen} trigger={trigger} title={title ?? label}>
        <MenuMode.Provider value={{ sheet: true, close: () => setOpen(false) }}>
          <div className="-mx-1 flex flex-col pb-2">{children}</div>
        </MenuMode.Provider>
      </Sheet>
    );
  }
  return (
    <DM.Root open={open} onOpenChange={setOpen}>
      <DM.Trigger asChild ref={triggerRef}>
        {trigger}
      </DM.Trigger>
      <DM.Portal container={container}>
        <DM.Content
          ref={(node) => rememberLayerTrigger(node, triggerRef.current)}
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={16}
          loop
          data-nav-trap
          // Back to the trigger as Radix does, without the keyboard's ring after a pointer (layers.focusBack).
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (triggerRef.current) focusBack(triggerRef.current);
          }}
          onKeyDown={(e) => {
            if (isLayerBackKey(e)) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={cn(
            "z-popover max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto border border-line bg-surface-2 text-text-1 shadow-float transition-[opacity,scale] duration-base ease-base starting:scale-95 starting:opacity-0",
            panel ? "w-80 rounded-lg p-2" : "min-w-56 max-w-80 rounded-md p-1",
            stage && "stage",
          )}
        >
          <MenuMode.Provider value={{ sheet: false }}>{children}</MenuMode.Provider>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function ItemContent({
  icon: Icon,
  lead,
  danger,
  children,
  end,
}: {
  icon?: LucideIcon;
  lead?: ReactNode;
  danger?: boolean;
  children: ReactNode;
  end?: ReactNode;
}) {
  return (
    <>
      {lead ?? (Icon && <Icon aria-hidden className={cn("size-5 shrink-0", danger ? "text-danger" : "text-text-2")} />)}
      <span className="min-w-0 flex-1">{children}</span>
      {end}
    </>
  );
}

export interface MenuItemProps {
  /** A 6.4 icon (20 px). */
  icon?: LucideIcon;
  /** In the icon's place, something that is not an icon: a profile's avatar (the account menu, 7.19). */
  lead?: ReactNode;
  children: ReactNode;
  /** After the label, at the row's end: a tag, a lock. */
  end?: ReactNode;
  /** What the item does; the menu closes first. */
  onSelect?: () => void;
  /** A link item: goes to this address instead of running `onSelect`. */
  href?: string;
  /** "Delete …": last in the menu, after a separator. */
  tone?: "danger";
  disabled?: boolean;
}

export function MenuItem({ icon, lead, children, end, onSelect, href, tone, disabled }: MenuItemProps) {
  const mode = useContext(MenuMode);
  const danger = tone === "danger";
  const content = (
    <ItemContent icon={icon} lead={lead} danger={danger} end={end}>
      {children}
    </ItemContent>
  );
  if (mode.sheet) {
    const cls = cn(SHEET_ITEM, danger && "text-danger");
    if (href)
      return (
        <IntlLink href={href} className={cls} onClick={mode.close}>
          {content}
        </IntlLink>
      );
    return (
      <button
        type="button"
        disabled={disabled}
        className={cls}
        onClick={() => {
          mode.close();
          onSelect?.();
        }}
      >
        {content}
      </button>
    );
  }
  const cls = cn(ITEM, danger && DANGER);
  if (href)
    return (
      <DM.Item asChild disabled={disabled} onSelect={onSelect}>
        <IntlLink href={href} className={cls}>
          {content}
        </IntlLink>
      </DM.Item>
    );
  return (
    <DM.Item disabled={disabled} onSelect={() => onSelect?.()} className={cls}>
      {content}
    </DM.Item>
  );
}

export interface MenuCheckboxItemProps {
  icon?: LucideIcon;
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** The menu stays open after the item is switched: one of several choices (a catalog's genres). */
  keepOpen?: boolean;
}

/** An item that turns something on or off ("Favourites"): a check on the end while it is on. */
export function MenuCheckboxItem({
  icon,
  children,
  checked,
  onCheckedChange,
  disabled,
  keepOpen,
}: MenuCheckboxItemProps) {
  const mode = useContext(MenuMode);
  const check = <Check aria-hidden className="size-5 shrink-0 text-text-1" />;
  if (mode.sheet) {
    return (
      <button
        type="button"
        aria-pressed={checked}
        disabled={disabled}
        className={SHEET_ITEM}
        onClick={() => {
          if (!keepOpen) mode.close();
          onCheckedChange(!checked);
        }}
      >
        <ItemContent icon={icon} end={checked ? check : null}>
          {children}
        </ItemContent>
      </button>
    );
  }
  return (
    <DM.CheckboxItem
      checked={checked}
      onCheckedChange={(c) => onCheckedChange(c === true)}
      // Radix closes the menu on select unless the event is prevented.
      onSelect={keepOpen ? (e) => e.preventDefault() : undefined}
      disabled={disabled}
      className={ITEM}
    >
      <ItemContent icon={icon} end={<DM.ItemIndicator>{check}</DM.ItemIndicator>}>
        {children}
      </ItemContent>
    </DM.CheckboxItem>
  );
}

/** A group heading inside a menu (sentence case, no capitals: 2.2). */
export function MenuLabel({ children }: { children: ReactNode }) {
  const mode = useContext(MenuMode);
  return mode.sheet ? <p className={LABEL}>{children}</p> : <DM.Label className={LABEL}>{children}</DM.Label>;
}

/** `quiet`: groups apart by space alone, no line (a panel's groups, 7.19). */
export function MenuSeparator({ quiet = false }: { quiet?: boolean }) {
  const mode = useContext(MenuMode);
  if (quiet) return mode.sheet ? <hr className="my-1.5 h-0 border-0" /> : <DM.Separator className="h-2" />;
  return mode.sheet ? (
    <hr className="my-2 h-px border-0 bg-line" />
  ) : (
    <DM.Separator className="-mx-1 my-1 h-px bg-line" />
  );
}

/**
 * Profiles as faces, up to four in a row and centred as "Who's watching?" centres them (7.17): one profile or a kids
 * profile's single face stands in the middle, not alone at the start (the account menu, 7.19).
 */
export function MenuFaces({ label, children }: { label: string; children: ReactNode }) {
  const mode = useContext(MenuMode);
  const cls = "flex flex-wrap justify-center gap-x-1 gap-y-0.5 pt-1 pb-1";
  return mode.sheet ? (
    <fieldset className={cn(cls, "m-0 min-w-0 border-0")}>
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  ) : (
    <DM.Group aria-label={label} className={cls}>
      {children}
    </DM.Group>
  );
}

export interface MenuFaceProps {
  /** The face: a profile's avatar (48; 56 in a phone's sheet) or the "+" of a new profile. */
  face: ReactNode;
  /** Under the face, on one line. */
  label: string;
  /** Under the name: a kids profile's Tag. */
  tag?: ReactNode;
  /** The profile in use: ringed as on "Who's watching?", not an item to press. */
  current?: boolean;
  /** What a screen reader hears after the name ("current profile", "protected"). */
  note?: string;
  onSelect?: () => void;
  href?: string;
}

// A face's cell: four to the panel's width (72 + gaps in 304; 80 in a phone's sheet).
const FACE = "group/face flex w-18 min-w-0 flex-col items-center gap-1.5 rounded-md px-1 pt-2 pb-1.5 text-center outline-none";
const FACE_RING = "relative rounded-avatar transition-transform duration-fast ease-fast";

/** One face of MenuFaces: a menu item (an arrow reaches it, Enter picks it) unless it is the current one. */
export function MenuFace({ face, label, tag, current, note, onSelect, href }: MenuFaceProps) {
  const mode = useContext(MenuMode);
  const body = (
    <>
      <span className={cn(FACE_RING, current ? "outline-2 outline-offset-3 outline-text-1 outline-solid" : "group-hover/face:scale-105 group-data-highlighted/face:scale-105 motion-reduce:transform-none")}>
        {face}
      </span>
      {/* A long name takes a second line rather than losing its end (as on "Who's watching?" on a phone). */}
      <span className={cn("line-clamp-2 w-full break-words", mode.sheet ? "text-body-s" : "text-caption", current ? "font-semibold text-text-1" : "text-text-2 group-hover/face:text-text-1 group-data-highlighted/face:text-text-1")}>
        {label}
        {note && <span className="sr-only"> · {note}</span>}
      </span>
      {tag}
    </>
  );
  if (current)
    return (
      <div aria-current="true" className={cn(FACE, mode.sheet && "w-20")}>
        {body}
      </div>
    );
  if (mode.sheet) {
    const cls = cn(FACE, "w-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:bg-surface-2");
    if (href)
      return (
        <IntlLink href={href} className={cls} onClick={mode.close}>
          {body}
        </IntlLink>
      );
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          mode.close();
          onSelect?.();
        }}
      >
        {body}
      </button>
    );
  }
  const cls = cn(FACE, "cursor-pointer select-none transition-colors duration-fast ease-fast data-highlighted:bg-surface-3");
  if (href)
    return (
      <DM.Item asChild onSelect={onSelect}>
        <IntlLink href={href} className={cls}>
          {body}
        </IntlLink>
      </DM.Item>
    );
  return (
    <DM.Item onSelect={() => onSelect?.()} className={cls}>
      {body}
    </DM.Item>
  );
}
