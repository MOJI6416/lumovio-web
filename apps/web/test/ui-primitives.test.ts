import { describe, expect, it } from "vitest";
import { buttonClass } from "../src/components/ui/Button";
import { cn } from "../src/components/ui/cn";
import { filterOptions } from "../src/components/ui/filter-options";
import { rovingIndex } from "../src/components/ui/keyboard";

const classes = (s: string) => s.split(" ");

describe("cn: the caller's class wins over a primitive's class of the same kind", () => {
  it("keeps the design-system type scale apart from text colours", () => {
    expect(cn("text-body text-text-1", "text-danger")).toBe("text-body text-danger");
    expect(cn("text-body font-semibold", "text-base")).toBe("font-semibold text-base");
    expect(cn("text-body-s", "text-caption")).toBe("text-caption");
  });
  it("knows sizes, layers, shadows and motion tokens", () => {
    expect(cn("h-10 px-4", "h-9")).toBe("px-4 h-9");
    expect(cn("z-popover", "z-toast")).toBe("z-toast");
    expect(cn("shadow-float", "shadow-none")).toBe("shadow-none");
    expect(cn("duration-fast", "duration-base")).toBe("duration-base");
  });
});

// cn.ts keeps a small configuration of its own; these are the conflicts the primitives and callers rely on.
describe("cn: the minimal tailwind-merge configuration", () => {
  it("never treats a type-scale size and a text colour as one kind", () => {
    expect(cn("text-body text-text-1")).toBe("text-body text-text-1");
    expect(cn("text-text-1", "text-body-s")).toBe("text-text-1 text-body-s");
    expect(cn("text-[0.8125rem] text-danger")).toBe("text-[0.8125rem] text-danger");
    expect(cn("text-text-2", "text-start", "text-balance", "truncate")).toBe(
      "text-text-2 text-start text-balance truncate",
    );
  });
  it("replaces a background colour with another, keeps images and gradients apart", () => {
    expect(cn("bg-surface-2", "bg-danger")).toBe("bg-danger");
    expect(cn("bg-stage/60", "bg-linear-to-t", "from-stage")).toBe("bg-stage/60 bg-linear-to-t from-stage");
  });
  it("lets a side refine a whole and a whole replace its sides", () => {
    expect(cn("p-2", "px-4")).toBe("p-2 px-4");
    expect(cn("px-4", "p-2")).toBe("p-2");
    expect(cn("ps-3 pe-2", "px-4")).toBe("px-4");
    expect(cn("-mt-1 -me-2", "m-0")).toBe("m-0");
    expect(cn("inset-0", "start-2")).toBe("inset-0 start-2");
  });
  it("knows that size sets width and height", () => {
    expect(cn("h-10", "size-11")).toBe("size-11");
    expect(cn("w-full h-10 max-sm:h-11", "max-sm:size-11")).toBe("w-full h-10 max-sm:size-11");
    expect(cn("size-8", "h-10")).toBe("size-8 h-10");
  });
  it("replaces radii, borders, rings and outlines of the same kind only", () => {
    expect(cn("rounded-sm", "rounded-md")).toBe("rounded-md");
    expect(cn("rounded-sm", "rounded-avatar")).toBe("rounded-avatar");
    expect(cn("rounded-t-lg", "rounded-lg")).toBe("rounded-lg");
    expect(cn("border border-line-2", "border-danger")).toBe("border border-danger");
    expect(cn("border-2", "border-b-0")).toBe("border-2 border-b-0");
    expect(cn("ring-3 ring-accent-soft", "ring-line")).toBe("ring-3 ring-line");
    expect(cn("outline-(length:--focus-width) outline-focus outline-offset-2", "outline-none")).toBe(
      "outline-(length:--focus-width) outline-focus outline-offset-2 outline-none",
    );
    expect(cn("inset-0", "inset-ring inset-ring-line-2")).toBe("inset-0 inset-ring inset-ring-line-2");
  });
  it("keeps variants, importance and arbitrary properties apart", () => {
    expect(cn("h-8 max-sm:h-11", "h-9")).toBe("max-sm:h-11 h-9");
    expect(cn("text-bg!", "text-text-1")).toBe("text-bg! text-text-1");
    expect(cn("[text-decoration-line:var(--link-decoration)]", "hover:underline")).toBe(
      "[text-decoration-line:var(--link-decoration)] hover:underline",
    );
  });
  it("keeps a class it doesn't know instead of dropping it", () => {
    expect(cn("tabular-nums", "stage", "group", "data-[state=open]:border-focus")).toBe(
      "tabular-nums stage group data-[state=open]:border-focus",
    );
  });
});

describe("Button variants", () => {
  it("has only the five design variants, none of them redrawn as a stage", () => {
    expect(classes(buttonClass("primary"))).toEqual(expect.arrayContaining(["bg-text-1", "text-bg"]));
    expect(classes(buttonClass("secondary"))).toEqual(expect.arrayContaining(["bg-surface-2", "border-line-2"]));
    expect(classes(buttonClass("tertiary"))).toContain("text-text-1");
    expect(classes(buttonClass("danger"))).toContain("bg-danger");
    expect(classes(buttonClass("danger-tertiary"))).toContain("text-danger");
    for (const v of ["primary", "secondary", "tertiary", "danger", "danger-tertiary"] as const)
      expect(classes(buttonClass(v))).not.toContain("stage");
  });
  it("lets a conflicting class from the caller win instead of silently losing", () => {
    const c = classes(buttonClass("tertiary", "md", "text-danger"));
    expect(c).toContain("text-danger");
    expect(c).not.toContain("text-text-1");
  });
  it("is 32/40/48 px with a 44 px minimum on a phone for sm and md", () => {
    expect(classes(buttonClass("primary", "sm"))).toEqual(expect.arrayContaining(["h-8", "max-sm:h-11"]));
    expect(classes(buttonClass("primary", "md"))).toEqual(expect.arrayContaining(["h-10", "max-sm:h-11"]));
    expect(classes(buttonClass("primary", "lg"))).toContain("h-12");
  });
});

describe("rovingIndex: arrows in tabs and segmented controls", () => {
  it("steps and wraps around", () => {
    expect(rovingIndex(0, "ArrowRight", 3)).toBe(1);
    expect(rovingIndex(2, "ArrowRight", 3)).toBe(0);
    expect(rovingIndex(0, "ArrowLeft", 3)).toBe(2);
  });
  it("mirrors left and right in right-to-left text", () => {
    expect(rovingIndex(0, "ArrowLeft", 3, { rtl: true })).toBe(1);
    expect(rovingIndex(0, "ArrowRight", 3, { rtl: true })).toBe(2);
  });
  it("jumps with Home and End", () => {
    expect(rovingIndex(1, "Home", 4)).toBe(0);
    expect(rovingIndex(1, "End", 4)).toBe(3);
  });
  it("uses up and down only for a radio group", () => {
    expect(rovingIndex(0, "ArrowDown", 3)).toBeNull();
    expect(rovingIndex(0, "ArrowDown", 3, { upDown: true })).toBe(1);
    expect(rovingIndex(0, "ArrowUp", 3, { upDown: true })).toBe(2);
  });
  it("skips disabled items, also at the ends", () => {
    const disabled = (i: number) => i === 1 || i === 3;
    expect(rovingIndex(0, "ArrowRight", 4, { disabled })).toBe(2);
    expect(rovingIndex(2, "ArrowRight", 4, { disabled })).toBe(0);
    expect(rovingIndex(2, "End", 4, { disabled })).toBe(2);
    expect(rovingIndex(2, "Home", 4, { disabled: (i) => i === 0 })).toBe(1);
  });
  it("ignores other keys and empty groups", () => {
    expect(rovingIndex(0, "Enter", 3)).toBeNull();
    expect(rovingIndex(0, "ArrowRight", 0)).toBeNull();
  });
});

describe("filterOptions: the Combobox search", () => {
  const languages = [
    { label: "Английский", keywords: ["English", "en"] },
    { label: "Немецкий", keywords: ["Deutsch", "de"] },
    { label: "Французский", keywords: ["Français", "fr"] },
    { label: "Украинский", keywords: ["Українська", "uk"] },
    { label: "Португальский (Бразилия)", keywords: ["Português", "pt-BR"] },
  ];
  const labels = (q: string) => filterOptions(languages, q).map((o) => o.label);

  it("shows everything for an empty query", () => {
    expect(labels("  ")).toHaveLength(5);
  });
  it("ignores case and accents and finds by keywords", () => {
    expect(labels("FRANCAIS")).toEqual(["Французский"]);
    expect(labels("deutsch")).toEqual(["Немецкий"]);
    expect(labels("pt-br")).toEqual(["Португальский (Бразилия)"]);
  });
  it("puts options where a word starts with the text first", () => {
    expect(labels("бра")).toEqual(["Португальский (Бразилия)"]);
    expect(labels("укр")).toEqual(["Украинский"]);
    // Both start a word with it: the order of the list stays.
    expect(filterOptions([{ label: "Без звука" }, { label: "Звук" }], "звук").map((o) => o.label)).toEqual([
      "Без звука",
      "Звук",
    ]);
  });
  it("finds a part inside a word after the word starts", () => {
    const ranked = filterOptions([{ label: "Перезвук" }, { label: "Звук" }], "звук").map((o) => o.label);
    expect(ranked).toEqual(["Звук", "Перезвук"]);
  });
});
