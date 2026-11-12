import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createToastStore,
  TOAST_LIMIT,
  TOAST_LONG_MS,
  TOAST_SHORT_MS,
} from "../src/components/ui/toast-store";

// Toasts: at most 3, 4 s / 7 s, paused while hovered or focused.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const ids = (s: ReturnType<typeof createToastStore>) => s.getSnapshot().map((t) => t.message);

describe("toast queue", () => {
  it("keeps at most three, pushing the oldest out", () => {
    const s = createToastStore();
    for (const m of ["a", "b", "c", "d"]) s.push("info", m);
    expect(TOAST_LIMIT).toBe(3);
    expect(ids(s)).toEqual(["b", "c", "d"]);
  });

  it("closes a plain toast after 4 s, an error or a toast with an action after 7 s", () => {
    const s = createToastStore();
    s.push("success", "saved");
    s.push("error", "failed");
    s.push("info", "removed", { action: { label: "Undo", onClick: () => {} } });
    vi.advanceTimersByTime(TOAST_SHORT_MS - 1);
    expect(ids(s)).toEqual(["saved", "failed", "removed"]);
    vi.advanceTimersByTime(1);
    expect(ids(s)).toEqual(["failed", "removed"]);
    vi.advanceTimersByTime(TOAST_LONG_MS - TOAST_SHORT_MS);
    expect(ids(s)).toEqual([]);
  });

  it("stops the timers while hovered and goes on with the time that was left", () => {
    const s = createToastStore();
    s.push("success", "saved");
    vi.advanceTimersByTime(3000);
    s.hold("hover");
    vi.advanceTimersByTime(60_000);
    expect(ids(s)).toEqual(["saved"]);
    s.release("hover");
    vi.advanceTimersByTime(999);
    expect(ids(s)).toEqual(["saved"]);
    vi.advanceTimersByTime(1);
    expect(ids(s)).toEqual([]);
  });

  it("waits for both the pointer and the focus to leave", () => {
    const s = createToastStore();
    s.push("info", "x");
    s.hold("hover");
    s.hold("focus");
    s.release("hover");
    vi.advanceTimersByTime(TOAST_SHORT_MS * 3);
    expect(ids(s)).toEqual(["x"]);
    s.release("focus");
    vi.advanceTimersByTime(TOAST_SHORT_MS);
    expect(ids(s)).toEqual([]);
  });

  it("starts a toast that arrives during a pause only when the pause ends", () => {
    const s = createToastStore();
    s.hold("focus");
    s.push("info", "late");
    vi.advanceTimersByTime(TOAST_SHORT_MS * 2);
    expect(ids(s)).toEqual(["late"]);
    s.release("focus");
    vi.advanceTimersByTime(TOAST_SHORT_MS);
    expect(ids(s)).toEqual([]);
  });

  it("runs the action once and closes the toast", () => {
    const s = createToastStore();
    const undo = vi.fn();
    const id = s.push("info", "removed", { action: { label: "Undo", onClick: undo } });
    s.act(id);
    s.act(id);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(ids(s)).toEqual([]);
  });

  it("tells subscribers about every change", () => {
    const s = createToastStore();
    const seen = vi.fn();
    const off = s.subscribe(seen);
    const id = s.push("info", "x");
    s.dismiss(id);
    off();
    s.push("info", "y");
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
