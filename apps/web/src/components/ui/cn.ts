import { type ClassValue, clsx } from "clsx";
import { createTailwindMerge, validators as v } from "tailwind-merge";

/*
 * tailwind-merge with a small configuration of its own: only the kinds of class the primitives and
 * their callers' `className` use — spacing, sizes, flex/grid, position and layers, the type scale and text
 * colours, backgrounds, borders and radii, rings, outlines, shadows, opacity, motion, cursor. The full default
 * configuration knows every Tailwind utility and costs ~5 KB gzip more on every route.
 *
 * A class this configuration doesn't know is kept as it is (never dropped), so a gap here can only leave two
 * conflicting classes in place, the way plain `clsx` would. Groups mirror tailwind-merge's defaults (v3) so the result
 * is the same for the classes in use; test/ui-primitives.test.ts checks the conflicts that matter.
 *
 * The design-system scales (globals.css) are known: `text-body` is a font size (not a colour), `shadow-float` a
 * shadow, `z-popover` a layer, `duration-fast`/`ease-fast` motion.
 */

const any = [v.isAny];
const length = ["", v.isNumber, v.isArbitraryVariableLength, v.isArbitraryLength];
const lineStyle = ["solid", "dashed", "dotted", "double", "hidden", "none"];
const radius = ["", "none", "full", "avatar", v.isTshirtSize, v.isArbitraryVariable, v.isArbitraryValue];
const align = ["start", "end", "center", "between", "around", "evenly", "stretch", "baseline", "normal"];
const overflow = ["auto", "hidden", "clip", "visible", "scroll"];
const overscroll = ["auto", "contain", "none"];
const sides = (prefix: string, values: unknown[]) =>
  Object.fromEntries(
    ["x", "y", "s", "e", "t", "r", "b", "l"].map((s) => [`${prefix}-${s}`, [{ [`${prefix}-${s}`]: values }]]),
  );
const each = (ids: string[], values: unknown[] = any) =>
  Object.fromEntries(ids.map((id) => [id, [{ [id]: values }]]));

const TYPE = ["display", "h1", "h2", "h3", "title", "body-l", "body", "body-s", "caption"];

// Radii by side and corner, physical ones included (a caller may still write them); named by suffix.
const corner = (s: string) => `rounded-${s}`;
const CORNERS = ["s", "e", "t", "r", "b", "l", "ss", "se", "ee", "es", "tl", "tr", "br", "bl"].map(corner);
const SIDE_CORNERS = { s: "ss es", e: "se ee", t: "tl tr", r: "tr br", b: "br bl", l: "tl bl" };

const merge = createTailwindMerge(() => ({
  cacheSize: 500,
  theme: {},
  classGroups: {
    display: [
      "block",
      "inline-block",
      "inline",
      "flex",
      "inline-flex",
      "grid",
      "inline-grid",
      "contents",
      "hidden",
    ],
    sr: ["sr-only", "not-sr-only"],
    position: ["static", "fixed", "absolute", "relative", "sticky"],
    visibility: ["visible", "invisible", "collapse"],
    isolation: ["isolate", "isolation-auto"],
    // `inset-ring` and `inset-shadow` are their own kinds, not an inset.
    "inset-ring-w": [{ "inset-ring": length }],
    "inset-ring-color": [{ "inset-ring": any }],
    "inset-shadow": [{ "inset-shadow": any }],
    ...each(["inset", "inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left", "z"]),
    ...each(["overflow", "overflow-x", "overflow-y"], overflow),
    ...each(["overscroll", "overscroll-x", "overscroll-y"], overscroll),
    // Flex and grid
    basis: [{ basis: any }],
    "flex-direction": [{ flex: ["row", "row-reverse", "col", "col-reverse"] }],
    "flex-wrap": [{ flex: ["wrap", "wrap-reverse", "nowrap"] }],
    // After the named directions and wraps above: `flex-1`, `flex-auto`.
    flex: [{ flex: any }],
    ...each(["grow", "shrink"], ["", ...any]),
    order: [{ order: any }],
    ...each([
      "grid-cols",
      "grid-rows",
      "col-start",
      "col-end",
      "row-start",
      "row-end",
      "auto-cols",
      "auto-rows",
    ]),
    "col-start-end": [{ col: any }],
    "row-start-end": [{ row: any }],
    "grid-flow": [{ "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"] }],
    ...each(["gap", "gap-x", "gap-y"]),
    "justify-content": [{ justify: align }],
    "align-content": [{ content: align }],
    "align-items": [{ items: align }],
    ...each(
      ["justify-items", "justify-self", "self", "place-content", "place-items", "place-self"],
      ["auto", ...align],
    ),
    // Spacing and sizing
    ...each(["p", "px", "py", "ps", "pe", "pt", "pr", "pb", "pl"]),
    ...each(["m", "mx", "my", "ms", "me", "mt", "mr", "mb", "ml"]),
    ...each(["space-x", "space-y"]),
    ...each(["size", "w", "min-w", "max-w", "h", "min-h", "max-h", "aspect"]),
    // Type: the scale is a font size, the rest of `text-*` a colour
    "font-size": [
      { text: ["base", v.isTshirtSize, ...TYPE, v.isArbitraryVariableLength, v.isArbitraryLength] },
    ],
    "font-style": ["italic", "not-italic"],
    "font-weight": [
      { font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"] },
    ],
    tracking: [{ tracking: any }],
    "line-clamp": [{ "line-clamp": any }],
    leading: [{ leading: any }],
    "text-alignment": [{ text: ["left", "center", "right", "justify", "start", "end"] }],
    "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
    "text-wrap": [{ text: ["wrap", "nowrap", "balance", "pretty"] }],
    "text-color": [{ text: any }],
    "text-decoration": ["underline", "overline", "line-through", "no-underline"],
    "text-decoration-thickness": [
      { decoration: [v.isNumber, "from-font", "auto", v.isArbitraryVariable, v.isArbitraryLength] },
    ],
    "underline-offset": [{ "underline-offset": any }],
    "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
    whitespace: [{ whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"] }],
    break: [{ break: ["normal", "words", "all", "keep"] }],
    // Backgrounds: image, size, position and repeat by name, the rest a colour
    "bg-image": [{ bg: ["none", { linear: any, radial: ["", ...any], conic: ["", ...any] }] }],
    "bg-size": [{ bg: ["auto", "cover", "contain"] }],
    "bg-position": [
      {
        bg: [
          "center",
          "top",
          "bottom",
          "left",
          "right",
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ],
      },
    ],
    "bg-repeat": [{ bg: ["no-repeat", { repeat: ["", "x", "y", "space", "round"] }] }],
    "bg-color": [{ bg: any }],
    "gradient-from": [{ from: any }],
    "gradient-via": [{ via: any }],
    "gradient-to": [{ to: any }],
    // Radii, borders, outlines, rings, shadows
    rounded: [{ rounded: radius }],
    ...each(CORNERS, radius),
    "border-w": [{ border: length }],
    ...Object.fromEntries(
      Object.entries(sides("border", length)).map(([k, g]) => [k.replace("border", "border-w"), g]),
    ),
    "border-style": [{ border: lineStyle }],
    "border-collapse": [{ border: ["collapse", "separate"] }],
    "border-color": [{ border: any }],
    ...Object.fromEntries(
      Object.entries(sides("border", any)).map(([k, g]) => [k.replace("border", "border-color"), g]),
    ),
    "outline-style": [{ outline: lineStyle }],
    "outline-offset": [{ "outline-offset": any }],
    "outline-w": [{ outline: length }],
    "outline-color": [{ outline: any }],
    "ring-w": [{ ring: length }],
    "ring-w-inset": ["ring-inset"],
    "ring-color": [{ ring: any }],
    "ring-offset-w": [{ "ring-offset": [v.isNumber, v.isArbitraryLength] }],
    "ring-offset-color": [{ "ring-offset": any }],
    shadow: [
      {
        shadow: [
          "",
          "none",
          "inner",
          v.isTshirtSize,
          "float",
          v.isArbitraryVariableShadow,
          v.isArbitraryShadow,
        ],
      },
    ],
    "shadow-color": [{ shadow: any }],
    opacity: [{ opacity: any }],
    ...each(
      ["blur", "backdrop-blur"],
      ["", "none", v.isTshirtSize, v.isArbitraryVariable, v.isArbitraryValue],
    ),
    "drop-shadow": [{ "drop-shadow": ["", ...any] }],
    // Motion and transforms
    transition: [
      {
        transition: [
          "",
          "all",
          "colors",
          "opacity",
          "shadow",
          "transform",
          "none",
          v.isArbitraryVariable,
          v.isArbitraryValue,
        ],
      },
    ],
    ...each([
      "duration",
      "ease",
      "delay",
      "animate",
      "scale",
      "scale-x",
      "scale-y",
      "rotate",
      "translate",
      "translate-x",
      "translate-y",
    ]),
    "translate-none": ["translate-none"],
    // Interaction
    cursor: [{ cursor: any }],
    "pointer-events": [{ "pointer-events": ["auto", "none"] }],
    select: [{ select: ["none", "text", "all", "auto"] }],
    "object-fit": [{ object: ["contain", "cover", "fill", "none", "scale-down"] }],
    "object-position": [{ object: any }],
    origin: [{ origin: any }],
    "vertical-align": [
      { align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super"] },
    ],
    resize: [{ resize: ["", "none", "x", "y"] }],
    ...each(["scroll-mt", "scroll-px"]),
    fill: [{ fill: any }],
  },
  conflictingClassGroups: {
    overflow: ["overflow-x", "overflow-y"],
    overscroll: ["overscroll-x", "overscroll-y"],
    inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
    "inset-x": ["start", "end", "right", "left"],
    "inset-y": ["top", "bottom"],
    flex: ["basis", "grow", "shrink"],
    gap: ["gap-x", "gap-y"],
    p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
    px: ["ps", "pe", "pr", "pl"],
    py: ["pt", "pb"],
    m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
    mx: ["ms", "me", "mr", "ml"],
    my: ["mt", "mb"],
    size: ["w", "h"],
    "font-size": ["leading"],
    "line-clamp": ["display", "overflow"],
    rounded: CORNERS,
    ...Object.fromEntries(
      Object.entries(SIDE_CORNERS).map(([side, cs]) => [corner(side), cs.split(" ").map(corner)]),
    ),
    "border-w": [
      "border-w-x",
      "border-w-y",
      "border-w-s",
      "border-w-e",
      "border-w-t",
      "border-w-r",
      "border-w-b",
      "border-w-l",
    ],
    "border-w-x": ["border-w-s", "border-w-e", "border-w-r", "border-w-l"],
    "border-w-y": ["border-w-t", "border-w-b"],
    "border-color": [
      "border-color-x",
      "border-color-y",
      "border-color-s",
      "border-color-e",
      "border-color-t",
      "border-color-r",
      "border-color-b",
      "border-color-l",
    ],
    "border-color-x": ["border-color-s", "border-color-e", "border-color-r", "border-color-l"],
    "border-color-y": ["border-color-t", "border-color-b"],
    translate: ["translate-x", "translate-y", "translate-none"],
    "translate-none": ["translate", "translate-x", "translate-y"],
  },
  conflictingClassGroupModifiers: { "font-size": ["leading"] },
  orderSensitiveModifiers: [
    "*",
    "**",
    "after",
    "backdrop",
    "before",
    "file",
    "first-letter",
    "first-line",
    "marker",
    "placeholder",
    "selection",
  ],
}));

/**
 * Joins class names; a later class wins over an earlier one of the same kind. Primitives put their own classes
 * first and the caller's `className` last — the caller's classes are for placement (margins, `grow`, width),
 * merging is the safety net that keeps a conflicting class from silently losing.
 */
export function cn(...values: ClassValue[]) {
  return merge(clsx(values));
}
