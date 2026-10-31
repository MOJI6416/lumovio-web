"use client";

import { useFormatter } from "next-intl";
import { Tabs as T } from "radix-ui";
import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link as IntlLink } from "@/i18n/navigation";
import { cn } from "./cn";
import { rovingIndex } from "./keyboard";
import { groupFocusRing } from "./styles";

/*
 * Tabs (design-system 7.5): the sections of one page. Two forms with one look:
 * - `Tabs` + `TabList` + `Tab` + `TabPanel` — Radix Tabs, the choice lives in the component;
 * - `LinkTabs` + `LinkTabPanel` — each tab is a link (`?tab=…`), so the choice survives a reload, a shared link and
 *   Back (8.7). ←/→ move between tabs, Enter or Space opens one (manual activation: every tab is a navigation).
 * - `PillTabs` — a row of pills choosing which part of one list the panel under it shows (the seasons of a series).
 * On a phone the row scrolls sideways with faded edges and keeps the active tab in view.
 */

const LIST_WRAP = "border-b border-line";
const LIST = "scroll-row -mx-2 flex gap-4 overflow-x-auto md:gap-6";
// The ring sits inside the tab (negative offset) so the scrolling row cannot clip it.
const TAB =
  "group relative inline-flex shrink-0 select-none items-center whitespace-nowrap px-2 py-3 text-body font-bold text-text-2 transition-colors duration-base ease-base hover:text-text-1 aria-selected:text-text-1 focus-visible:-outline-offset-3 disabled:opacity-40";
const INDICATOR =
  "pointer-events-none absolute inset-x-2 bottom-0 h-0.75 rounded-t-xs bg-tab-indicator opacity-0 transition-opacity duration-base ease-base group-aria-selected:opacity-100";
const STICKY = "sticky top-0 z-sticky bg-bg";

/** A mask that fades whichever side of a scrolling row has more to show. */
function useEdgeFade(ref: RefObject<HTMLElement | null>): CSSProperties | undefined {
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const x = Math.abs(el.scrollLeft); // right-to-left rows scroll into negative values
      const rtl = getComputedStyle(el).direction === "rtl";
      const before = max > 1 && x > 1;
      const after = max > 1 && x < max - 1;
      setEdges({ left: rtl ? after : before, right: rtl ? before : after });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref]);
  if (!edges.left && !edges.right) return undefined;
  // An alpha mask, not a colour: "black" = fully shown.
  const mask = `linear-gradient(to right, ${edges.left ? "transparent" : "black"}, black 2rem, black calc(100% - 2rem), ${edges.right ? "transparent" : "black"})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/**
 * A mouse wheel scrolls the row sideways while it has more to show that way (a PC has no sideways swipe: the seasons of
 * a long series were out of reach, 2026-10-30); at the row's end the wheel scrolls the page again, as everywhere.
 */
function useWheelScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // zoom, or already sideways (a touchpad)
      const step = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
      const max = el.scrollWidth - el.clientWidth;
      const x = Math.abs(el.scrollLeft); // right-to-left rows scroll into negative values
      if (max < 1 || (step > 0 ? x >= max - 1 : x <= 1)) return;
      e.preventDefault();
      el.scrollBy({ left: getComputedStyle(el).direction === "rtl" ? -step : step });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}

/** Scrolls the row (never the page) so the active tab is fully visible, now and whenever it changes. */
function useActiveInView(ref: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const show = () => {
      const item = row.querySelector<HTMLElement>(selector);
      if (!item) return;
      const r = row.getBoundingClientRect();
      const i = item.getBoundingClientRect();
      const pad = 32;
      if (i.left < r.left) row.scrollLeft -= r.left - i.left + pad;
      else if (i.right > r.right) row.scrollLeft += i.right - r.right + pad;
    };
    show();
    const mo = new MutationObserver(show);
    mo.observe(row, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    return () => mo.disconnect();
  }, [ref, selector]);
}

function Count({ count }: { count?: number }) {
  const format = useFormatter();
  if (count == null) return null;
  return <span className="ms-1 font-semibold text-text-2 tabular-nums">· {format.number(count)}</span>;
}

/** Root of state tabs: `value`/`onValueChange` or `defaultValue`, as Radix Tabs. */
export function Tabs(props: ComponentProps<typeof T.Root>) {
  return <T.Root {...props} />;
}

export function TabList({
  label,
  sticky,
  className,
  children,
}: {
  /** Names the tab row for screen readers. */
  label: string;
  /** Sticks under the header (give the offset with `className="top-…"`). */
  sticky?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fade = useEdgeFade(ref);
  useActiveInView(ref, '[aria-selected="true"]');
  useWheelScroll(ref);
  return (
    <div className={cn(LIST_WRAP, sticky && STICKY, className)}>
      <T.List ref={ref} aria-label={label} className={LIST} style={fade}>
        {children}
      </T.List>
    </div>
  );
}

export function Tab({
  value,
  count,
  disabled,
  children,
}: {
  value: string;
  /** "· 12" after the label. */
  count?: number;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <T.Trigger value={value} disabled={disabled} className={TAB}>
      {children}
      <Count count={count} />
      <span aria-hidden className={INDICATOR} />
    </T.Trigger>
  );
}

export function TabPanel({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  return (
    <T.Content value={value} className={cn("focus-visible:outline-offset-4", className)}>
      {children}
    </T.Content>
  );
}

type Href = ComponentProps<typeof IntlLink>["href"];

export interface LinkTab {
  id: string;
  href: Href;
  label: string;
  count?: number;
}

/** The element id of a link tab, for `aria-labelledby` of its panel. */
export const linkTabId = (panelId: string, tabId: string) => `${panelId}-tab-${tabId}`;

/** Tabs whose choice is in the address (`?tab=…`). Render the active tab's content in `LinkTabPanel`. */
export function LinkTabs({
  tabs,
  activeId,
  label,
  panelId,
  sticky,
  className,
}: {
  tabs: LinkTab[];
  activeId: string;
  label: string;
  /** The id of the `LinkTabPanel` below. */
  panelId: string;
  sticky?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const fade = useEdgeFade(ref);
  useActiveInView(ref, '[aria-selected="true"]');
  useWheelScroll(ref);
  const active = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeId),
  );
  // The one tab stop of the row: the active tab, or the one the arrows moved to.
  const [stop, setStop] = useState(active);
  useEffect(() => setStop(active), [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = links.current.indexOf(document.activeElement as HTMLAnchorElement);
    if (from < 0) return;
    if (e.key === " ") {
      // A tab opens with Space as well as Enter (a link alone opens with Enter only).
      e.preventDefault();
      links.current[from]?.click();
      return;
    }
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const to = rovingIndex(from, e.key, tabs.length, { rtl });
    if (to == null) return;
    e.preventDefault();
    setStop(to);
    links.current[to]?.focus();
  };

  return (
    <div className={cn(LIST_WRAP, sticky && STICKY, className)}>
      <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKeyDown} className={LIST} style={fade}>
        {tabs.map((t, i) => (
          <IntlLink
            key={t.id}
            ref={(el) => {
              links.current[i] = el;
            }}
            href={t.href}
            replace
            scroll={false}
            role="tab"
            id={linkTabId(panelId, t.id)}
            aria-selected={t.id === activeId}
            aria-controls={panelId}
            tabIndex={i === stop ? 0 : -1}
            className={TAB}
          >
            {t.label}
            <Count count={t.count} />
            <span aria-hidden className={INDICATOR} />
          </IntlLink>
        ))}
      </div>
    </div>
  );
}

export function LinkTabPanel({
  panelId,
  activeId,
  className,
  children,
}: {
  panelId: string;
  activeId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={panelId} aria-labelledby={linkTabId(panelId, activeId)} className={className}>
      {children}
    </div>
  );
}

export interface PillTab<V extends string> {
  value: V;
  label: string;
}

/** The element id of a pill tab, for `aria-labelledby` of its panel. */
export const pillTabId = (panelId: string, value: string) => `${panelId}-pill-${value}`;

/**
 * A row of pill tabs (design-system 7.5, owner 2026-10-25): which part of one list the panel under it shows — the
 * seasons of a series ("1 season · 2 season … Specials"), never a filter and never a page's sections (those are Tabs).
 * Pills 40 px tall (44 to tap on a phone), the chosen one in the selection colours (7.4). One tab stop: ←/→ (Home/End)
 * move along the row, Enter or Space opens one (manual activation: each choice loads its part). The row scrolls sideways
 * with faded edges and keeps the chosen pill in view, so a long series opens with its current season visible.
 */
export function PillTabs<V extends string>({
  tabs,
  value,
  onValueChange,
  label,
  panelId,
  className,
}: {
  tabs: PillTab<V>[];
  value: V;
  onValueChange: (v: V) => void;
  /** Names the row for screen readers. */
  label: string;
  /** The id of the panel the pills choose for (`role="tabpanel"`, labelled with `pillTabId`). */
  panelId: string;
  /** Placement only. */
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const fade = useEdgeFade(ref);
  useActiveInView(ref, '[aria-selected="true"]');
  useWheelScroll(ref);
  const active = Math.max(
    0,
    tabs.findIndex((t) => t.value === value),
  );
  const [stop, setStop] = useState(active);
  useEffect(() => setStop(active), [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = items.current.indexOf(document.activeElement as HTMLButtonElement);
    if (from < 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const to = rovingIndex(from, e.key, tabs.length, { rtl });
    if (to == null) return;
    e.preventDefault();
    setStop(to);
    items.current[to]?.focus();
  };

  return (
    // The padding keeps the focus ring of a pill inside the scrolling row (it would clip it); the margin gives it back.
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("scroll-row -m-2 flex gap-2 overflow-x-auto p-2", className)}
      style={fade}
    >
      {tabs.map((t, i) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              items.current[i] = el;
            }}
            type="button"
            role="tab"
            id={pillTabId(panelId, t.value)}
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={i === stop ? 0 : -1}
            onClick={() => onValueChange(t.value)}
            className="group inline-flex shrink-0 select-none items-center focus-visible:outline-none focus-visible:shadow-none max-sm:min-h-11"
          >
            <span
              className={cn(
                "inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-body font-semibold transition-colors duration-base ease-base in-data-[tv=1]:h-12",
                groupFocusRing,
                on ? "border-transparent bg-selected-bg text-selected-fg" : "border-line-2 text-text-1 group-hover:bg-surface-2",
              )}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
