import { SUBTITLE_STYLE_DEFAULTS, SubtitleStyle } from "@lumovio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { loadOffset, saveOffset } from "../src/lib/media/subs/choice";
import { placeBitmaps, restyleAss } from "../src/lib/media/subs/style";
import { SUBTITLE_DEFAULTS, shiftCue, stepOffset } from "../src/lib/media/subs/view";

const ASS = [
  "[Script Info]",
  "ScriptType: v4.00+",
  "PlayResX: 1920",
  "PlayResY: 1080",
  "",
  "[V4+ Styles]",
  "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  "Style: Default,Arial,60,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,2,20,20,40,1",
  "Style: Sign,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,8,20,20,30,1",
  "",
  "[Events]",
  "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Style: not a style line, 60",
].join("\n");

const style = (s: Partial<SubtitleStyle>): SubtitleStyle => ({ ...SUBTITLE_STYLE_DEFAULTS, ...s });

describe("the profile's subtitle look", () => {
  it("the contract: four choices, each with a default", () => {
    expect(SubtitleStyle.parse(SUBTITLE_STYLE_DEFAULTS)).toEqual({ size: "m", color: "white", edge: "shadow", position: "bottom" });
    expect(SubtitleStyle.safeParse({ ...SUBTITLE_STYLE_DEFAULTS, color: "red" }).success).toBe(false);
    // The web's own copy (no zod in the player's first load) is the same.
    expect(SUBTITLE_DEFAULTS).toEqual(SUBTITLE_STYLE_DEFAULTS);
  });

  it("ASS: the size scales fonts, outlines and shadows; nothing else changes", () => {
    const out = restyleAss(ASS, style({ size: "l" }));
    expect(out).toContain("Style: Default,Arial,75,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3.75,1.25,2,20,20,40,1");
    expect(out).toContain("Style: Sign,Arial,60,");
    // Dialogue lines stay as they are, even one that reads like a style.
    expect(out.split("\n").at(-1)).toBe("Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Style: not a style line, 60");
    expect(restyleAss(ASS, SUBTITLE_STYLE_DEFAULTS)).toBe(ASS);
  });

  it("ASS: higher lifts only the bottom-aligned styles, by 8 % of the script's height", () => {
    const out = restyleAss(ASS, style({ position: "raised" })).split("\n");
    expect(out.find((l) => l.startsWith("Style: Default"))!.split(",")[21]).toBe("126");
    expect(out.find((l) => l.startsWith("Style: Sign"))!.split(",")[21]).toBe("30");
    // No PlayResY: libass's 288.
    const bare = "[V4+ Styles]\nFormat: Name, Fontsize, Alignment, MarginV\nStyle: A,20,1,10\r\n";
    expect(restyleAss(bare, style({ position: "raised" }))).toBe("[V4+ Styles]\nFormat: Name, Fontsize, Alignment, MarginV\nStyle: A,20,1,33\r\n");
  });

  it("pictures: two lines at the bottom scaled together about their bottom centre, without overlapping", () => {
    const frame = { width: 1920, height: 1080 };
    const lines = [
      { x: 760, y: 900, width: 400, height: 50 },
      { x: 710, y: 960, width: 500, height: 50 },
    ];
    const [a, b] = placeBitmaps(lines, frame, style({ size: "xl" }));
    expect(b).toEqual({ x: 585, y: 935, width: 750, height: 75 });
    expect(a).toEqual({ x: 660, y: 845, width: 600, height: 75 });
    expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
    // Higher: 8 % of the frame up.
    expect(placeBitmaps(lines, frame, style({ position: "raised" }))[1]!.y).toBe(960 - 86);
  });

  it("pictures: a sign at the top grows from its top; a line grows no wider than the frame", () => {
    const frame = { width: 720, height: 576 };
    const [sign, wide] = placeBitmaps(
      [
        { x: 300, y: 20, width: 120, height: 30 },
        { x: 0, y: 500, width: 700, height: 60 },
      ],
      frame,
      style({ size: "xl" }),
    );
    expect(sign).toEqual({ x: 270, y: 20, width: 180, height: 45 });
    // As large as still fits: the frame's width, standing on its own bottom.
    expect(wide).toEqual({ x: 0, y: 498, width: 720, height: 62 });
  });
});

describe("the timing offset", () => {
  it("steps of 0.5 s, in tenths, within ±30 s", () => {
    expect(stepOffset(0, 0.5)).toBe(0.5);
    expect(stepOffset(0.1 + 0.2, 0.5)).toBe(0.8);
    expect(stepOffset(-29.8, -0.5)).toBe(-30);
    expect(stepOffset(30, 0.5)).toBe(30);
  });

  it("moves a cue from its own times, never adding up, never before 0", () => {
    const cue = { startTime: 10, endTime: 12 };
    shiftCue(cue, 1.5);
    expect(cue).toEqual({ startTime: 11.5, endTime: 13.5 });
    shiftCue(cue, -1);
    expect(cue).toEqual({ startTime: 9, endTime: 11 });
    shiftCue(cue, -11);
    expect(cue).toEqual({ startTime: 0, endTime: 1 });
    shiftCue(cue, 0);
    expect(cue).toEqual({ startTime: 10, endTime: 12 });
  });

  it("is remembered per title on this device; back at 0 it is forgotten", () => {
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    });
    expect(loadOffset("p:movie:1")).toBe(0);
    saveOffset("p:movie:1", -1.5);
    saveOffset("p:movie:2", 2);
    expect(loadOffset("p:movie:1")).toBe(-1.5);
    saveOffset("p:movie:1", 0);
    expect(loadOffset("p:movie:1")).toBe(0);
    expect(Object.keys(JSON.parse(store.get("lumovio.player.subtitle-offset")!))).toEqual(["p:movie:2"]);
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});
