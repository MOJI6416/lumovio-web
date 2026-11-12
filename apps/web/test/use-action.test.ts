import { describe, expect, it, vi } from "vitest";
import { type ActionEnv, runAction } from "../src/lib/action";
import { ApiRequestError } from "../src/lib/api";

// Success → toast (with Undo); failure → rollback + toast in words; never swallowed.

function fakeEnv() {
  const toasts: { tone: string; message: string; action?: { label: string; onClick: () => void } }[] = [];
  const env: ActionEnv = {
    notify: (tone, message, options) => toasts.push({ tone, message, action: options?.action }),
    errorMessage: (e) => (e instanceof ApiRequestError ? `t:${e.code}` : "t:generic"),
    undoLabel: "Undo",
    undoFailed: "Couldn't undo",
  };
  return { env, toasts };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("runAction", () => {
  it("success: syncs, shows the message and returns the value", async () => {
    const { env, toasts } = fakeEnv();
    const sync = vi.fn();
    const r = await runAction(
      { run: async (n: number) => n * 2, success: (v) => `got ${v}`, sync },
      [21],
      env,
    );
    expect(r).toEqual({ ok: true, value: 42 });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual([{ tone: "success", message: "got 42", action: undefined }]);
  });

  it("the success toast carries the action's mark, with or without Undo; a failure never does", async () => {
    const icons: unknown[] = [];
    const env: ActionEnv = { ...fakeEnv().env, notify: (_tone, _message, options) => icons.push(options?.icon) };
    await runAction({ run: async () => 1, success: "Added", successIcon: "favourite", undo: async () => {} }, [], env);
    await runAction({ run: async (on: boolean) => on, success: "Rated", successIcon: (on) => (on ? "rating" : undefined) }, [true], env);
    await runAction({ run: async () => Promise.reject(new Error("no")), success: "Added", successIcon: "favourite" }, [], env);
    expect(icons).toEqual(["favourite", "rating", undefined]);
  });

  it("success without a message: no toast (the change is visible in place)", async () => {
    const { env, toasts } = fakeEnv();
    await runAction({ run: async () => 1, success: null }, [], env);
    expect(toasts).toEqual([]);
  });

  it("failure: rolls the optimistic change back and says what went wrong in words", async () => {
    const { env, toasts } = fakeEnv();
    const list = ["a", "b"];
    const sync = vi.fn();
    const r = await runAction(
      {
        run: async () => {
          expect(list).toEqual(["b"]); // already on screen while the request runs
          throw new ApiRequestError(500, "internal", 'Failed query: delete from "history"');
        },
        optimistic: () => {
          const i = list.indexOf("a");
          list.splice(i, 1);
          return () => list.splice(i, 0, "a");
        },
        success: "removed",
        sync,
      },
      [],
      env,
    );
    expect(r.ok).toBe(false);
    expect(list).toEqual(["a", "b"]);
    expect(sync).not.toHaveBeenCalled();
    expect(toasts).toEqual([{ tone: "error", message: "t:internal", action: undefined }]);
    expect(JSON.stringify(toasts)).not.toContain("Failed query");
    if (!r.ok) expect(r.message).toBe("t:internal");
  });

  it("failure with the screen's own words", async () => {
    const { env, toasts } = fakeEnv();
    await runAction(
      {
        run: async (_title: string) => {
          throw new ApiRequestError(0, "network", "Network error");
        },
        error: (_e, title) => `Couldn't remove ${title}`,
      },
      ["Dune"],
      env,
    );
    expect(toasts[0]).toMatchObject({ tone: "error", message: "Couldn't remove Dune" });
  });

  it("undo: the toast carries Undo; it restores, puts the item back and syncs again", async () => {
    const { env, toasts } = fakeEnv();
    const list = ["a", "b"];
    const sync = vi.fn();
    const restore = vi.fn(async () => {});
    await runAction(
      {
        run: async (id: string) => ({ removed: id }),
        optimistic: (id) => {
          list.splice(list.indexOf(id), 1);
          return () => list.unshift(id);
        },
        success: (_, id) => `Removed ${id}`,
        undo: (result) => restore(result.removed),
        sync,
      },
      ["a"],
      env,
    );
    expect(list).toEqual(["b"]);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ tone: "info", message: "Removed a", action: { label: "Undo" } });
    toasts[0]?.action?.onClick();
    await flush();
    expect(restore).toHaveBeenCalledWith("a");
    expect(list).toEqual(["a", "b"]);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("undo that fails: says so and leaves the screen as the server has it", async () => {
    const { env, toasts } = fakeEnv();
    const list = ["b"];
    const rollback = vi.fn();
    await runAction(
      {
        run: async () => true,
        optimistic: () => rollback,
        success: "Removed",
        undo: async () => {
          throw new ApiRequestError(500, "internal", "x");
        },
      },
      [],
      env,
    );
    toasts[0]?.action?.onClick();
    await flush();
    expect(rollback).not.toHaveBeenCalled();
    expect(list).toEqual(["b"]);
    expect(toasts[1]).toMatchObject({ tone: "error", message: "Couldn't undo" });
  });
  it("a failure with a way out: the session ended — the error toast offers \"Sign in\" (errorAction)", async () => {
    const { env, toasts } = fakeEnv();
    const signIn = vi.fn();
    env.errorAction = (e) => (e instanceof ApiRequestError && e.code === "unauthorized" ? { label: "Sign in", onClick: signIn } : undefined);
    const r = await runAction(
      {
        run: async () => {
          throw new ApiRequestError(401, "unauthorized", "x");
        },
      },
      [],
      env,
    );
    expect(r.ok).toBe(false);
    expect(toasts).toEqual([{ tone: "error", message: "t:unauthorized", action: { label: "Sign in", onClick: signIn } }]);
    toasts[0]?.action?.onClick();
    expect(signIn).toHaveBeenCalledTimes(1);
    // Other failures keep a plain toast.
    await runAction({ run: async () => Promise.reject(new ApiRequestError(500, "internal", "x")) }, [], env);
    expect(toasts[1]).toEqual({ tone: "error", message: "t:internal", action: undefined });
  });

  it("a failure with its own words and \"Retry\"; \"Sign in\" still comes first after a 401", async () => {
    const { env, toasts } = fakeEnv();
    const retry = vi.fn();
    const signIn = vi.fn();
    env.errorAction = (e) => (e instanceof ApiRequestError && e.code === "unauthorized" ? { label: "Sign in", onClick: signIn } : undefined);
    const options = {
      run: async (code: string) => Promise.reject(new ApiRequestError(code === "unauthorized" ? 401 : 500, code, "x")),
      error: (_e: unknown, code: string) => (code === "internal" ? "List made, title not added" : undefined),
      errorAction: () => ({ label: "Retry", onClick: retry }),
    };
    await runAction(options, ["internal"], env);
    expect(toasts[0]).toEqual({ tone: "error", message: "List made, title not added", action: { label: "Retry", onClick: retry } });
    // Nothing of its own: the API error's words.
    await runAction(options, ["unauthorized"], env);
    expect(toasts[1]).toEqual({ tone: "error", message: "t:unauthorized", action: { label: "Sign in", onClick: signIn } });
  });
});
