import { cn } from "./cn";

/*
 * Shared class strings of the primitives. A plain module (no "use client"), so server components can use them too.
 *
 * Focus (design-system 6.6, 7.6). Most controls use the global `:focus-visible` ring from globals.css. These cover:
 * - a control whose hit area is larger than what you see (44 px on phones, 5.6): the control hides its own ring and
 *   the visible part, a `group`/`peer` child, draws it;
 * - fields (inputs, select and combobox triggers): a --focus border plus a soft 3 px halo instead of the ring.
 * On a stage (over art) the ring also has the dark --focus-halo (6.6): globals.css for the global ring, here for the
 * child-drawn one — so a control that hides its own ring hides the halo too (`focus-visible:shadow-none`), or the hit
 * area stood as a dark box round the ring.
 */
export const groupFocusRing =
  "group-focus-visible:outline-(length:--focus-width) group-focus-visible:outline-focus group-focus-visible:outline-offset-2 in-[.stage]:group-focus-visible:shadow-(--focus-halo)";

export const peerFocusRing =
  "peer-focus-visible:outline-(length:--focus-width) peer-focus-visible:outline-focus peer-focus-visible:outline-offset-2 in-[.stage]:peer-focus-visible:shadow-(--focus-halo)";

export const fieldFocus = "focus-visible:outline-none focus:border-focus focus:ring-3 focus:ring-accent-soft";

/** The same for a field that is a button (Select, Combobox): only from the keyboard, a click opens its list. */
export const fieldFocusVisible =
  "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-soft";

/** Fields: 44 px, 48 for forms on a phone (`lg`); on a TV always 48 (66 at its scale, 10.3). */
export type FieldSize = "md" | "lg";
export const FIELD_HEIGHT: Record<FieldSize, string> = { md: "h-11 in-data-[tv=1]:h-12", lg: "h-12" };

/** The box of every field: --surface-2, a --line-2 border (--danger with aria-invalid), 15 px text. */
export const fieldBox =
  "w-full rounded-sm border border-line-2 bg-surface-2 text-body text-text-1 placeholder:text-text-3 transition-[border-color,box-shadow] duration-fast ease-fast aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-40";

/** Classes of a one-line text field. */
export const inputClass = cn(fieldBox, fieldFocus, "h-11 px-3");
