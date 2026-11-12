import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A page of shelves in document order, an idle queue we run by hand and an IntersectionObserver we trigger.
type FakeEl = { pos: number; compareDocumentPosition: (o: FakeEl) => number };
const el = (pos: number): FakeEl => ({ pos, compareDocumentPosition: (o) => (o.pos > pos ? 4 : 2) });
let idle: (() => void)[] = [];
let observer: { cb: (e: { isIntersecting: boolean; target: FakeEl }[]) => void; observed: Set<FakeEl> } | null = null;

beforeEach(() => {
  vi.resetModules();
  idle = [];
  observer = null;
  vi.stubGlobal("Node", { DOCUMENT_POSITION_FOLLOWING: 4 });
  vi.stubGlobal("window", { requestIdleCallback: () => 0 });
  vi.stubGlobal("requestIdleCallback", (fn: () => void) => idle.push(fn));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observed = new Set<FakeEl>();
      constructor(cb: never) {
        observer = { cb, observed: this.observed };
      }
      observe(e: FakeEl) {
        this.observed.add(e);
      }
      unobserve(e: FakeEl) {
        this.observed.delete(e);
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const runIdle = () => {
  const fns = idle;
  idle = [];
  for (const f of fns) f();
};

describe("shelves after a client-side navigation are drawn in turns", () => {
  it("draws one shelf per idle moment, the highest on the page first", async () => {
    const { drawInTurn } = await import("../src/components/media/shelf-turns");
    const drawn: number[] = [];
    for (const pos of [3, 1, 2]) drawInTurn(el(pos) as never, () => drawn.push(pos));
    expect(drawn).toEqual([]);
    runIdle();
    expect(drawn).toEqual([1]);
    runIdle();
    runIdle();
    expect(drawn).toEqual([1, 2, 3]);
    runIdle();
    expect(drawn).toEqual([1, 2, 3]);
  });

  it("draws a shelf at once when it comes near the screen, and only once", async () => {
    const { drawInTurn } = await import("../src/components/media/shelf-turns");
    const drawn: number[] = [];
    const far = el(9);
    drawInTurn(el(1) as never, () => drawn.push(1));
    drawInTurn(far as never, () => drawn.push(9));
    observer!.cb([{ isIntersecting: true, target: far }]);
    expect(drawn).toEqual([9]);
    expect(observer!.observed.has(far)).toBe(false);
    runIdle();
    runIdle();
    expect(drawn).toEqual([9, 1]);
  });

  it("forgets a shelf that left before its turn", async () => {
    const { drawInTurn } = await import("../src/components/media/shelf-turns");
    const drawn: number[] = [];
    const stop = drawInTurn(el(1) as never, () => drawn.push(1));
    stop();
    runIdle();
    expect(drawn).toEqual([]);
  });
});
