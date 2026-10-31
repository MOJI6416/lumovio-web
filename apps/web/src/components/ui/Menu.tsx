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
            "z-popover max-h-(--radix-dropdown-menu-content-available-height) min-w-56 max-w-80 origin-(--radix-dropdown-menu-content-transform-origin) overflow-y-auto rounded-md border border-line bg-surface-2 p-1 text-text-1 shadow-float transition-[opacity,scale] duration-base ease-base starting:scale-95 starting:opacity-0",
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
  danger,
  children,
  end,
}: {
  icon?: LucideIcon;
  danger?: boolean;
  children: ReactNode;
  end?: ReactNode;
}) {
  return (
    <>
      {Icon && <Icon aria-hidden className={cn("size-5 shrink-0", danger ? "text-danger" : "text-text-2")} />}
      <span className="min-w-0 flex-1">{children}</span>
      {end}
    </>
  );
}

export interface MenuItemProps {
  /** A 6.4 icon (20 px). */
  icon?: LucideIcon;
  children: ReactNode;
  /** What the item does; the menu closes first. */
  onSelect?: () => void;
  /** A link item: goes to this address instead of running `onSelect`. */
  href?: string;
  /** "Delete …": last in the menu, after a separator. */
  tone?: "danger";
  disabled?: boolean;
}

export function MenuItem({ icon, children, onSelect, href, tone, disabled }: MenuItemProps) {
  const mode = useContext(MenuMode);
  const danger = tone === "danger";
  const content = (
    <ItemContent icon={icon} danger={danger}>
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
}

/** An item that turns something on or off ("Favourites"): a check on the end while it is on. */
export function MenuCheckboxItem({
  icon,
  children,
  checked,
  onCheckedChange,
  disabled,
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
          mode.close();
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

export function MenuSeparator() {
  const mode = useContext(MenuMode);
  return mode.sheet ? (
    <hr className="my-2 h-px border-0 bg-line" />
  ) : (
    <DM.Separator className="-mx-1 my-1 h-px bg-line" />
  );
}
