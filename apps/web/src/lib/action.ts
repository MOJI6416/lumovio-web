import type { ToastOptions } from "@/components/ui/toast-store";

/*
 * The rules of a user action (design-system 8.3), without React: lib/use-action wraps them in a hook with toasts and
 * translations; apps/web/test/use-action.test.ts checks them with fakes.
 */

export type ActionResult<R> = { ok: true; value: R } | { ok: false; error: unknown; message: string };

export interface ActionOptions<A extends unknown[], R> {
  /** The request. */
  run: (...args: A) => Promise<R>;
  /** Changes the screen at once and returns how to put it back (on failure, and after a successful Undo). */
  // biome-ignore lint/suspicious/noConfusingVoidType: a change that needs no putting back returns nothing
  optimistic?: (...args: A) => (() => void) | undefined | void;
  /** The toast when it worked; null or nothing when the change is visible where it happened (8.1). */
  success?: string | null | ((result: R, ...args: A) => string | null);
  /** The success toast's mark of the confirmed action instead of its tone's icon (the heart of Favourites, 6.3.1). */
  successIcon?: ToastOptions["icon"] | ((result: R, ...args: A) => ToastOptions["icon"]);
  /** Takes it back (a restore request); the success toast then carries "Undo". */
  undo?: (result: R, ...args: A) => Promise<unknown>;
  /** The failure's words; by default (or when the function gives nothing) the translated API error. */
  error?: string | ((error: unknown, ...args: A) => string | undefined);
  /**
   * The failure toast's own way on ("Retry"), where repeating can help (TTL-30). The environment's way out for the
   * failure's kind ("Sign in" after a 401) comes first.
   */
  errorAction?: (error: unknown, ...args: A) => ToastOptions["action"] | undefined;
  /** Brings dependent data up to date (invalidate queries): after success and after a successful Undo. */
  sync?: () => unknown;
}

/** What the helper talks to; the hook passes toasts and translations, tests pass fakes. */
export interface ActionEnv {
  notify: (tone: "success" | "error" | "info", message: string, options?: ToastOptions) => void;
  errorMessage: (error: unknown) => string;
  undoLabel: string;
  undoFailed: string;
  /**
   * A way out offered with a failure's toast, by its kind: "Sign in" when the session has ended (401). Optional; no
   * action when it returns nothing.
   */
  errorAction?: (error: unknown) => ToastOptions["action"] | undefined;
}

export async function runAction<A extends unknown[], R>(
  o: ActionOptions<A, R>,
  args: A,
  env: ActionEnv,
): Promise<ActionResult<R>> {
  const rollback = o.optimistic?.(...args) || undefined;
  let value: R;
  try {
    value = await o.run(...args);
  } catch (error) {
    rollback?.();
    const message = (typeof o.error === "function" ? o.error(error, ...args) : o.error) ?? env.errorMessage(error);
    const action = env.errorAction?.(error) ?? o.errorAction?.(error, ...args);
    env.notify("error", message, action ? { action } : undefined);
    return { ok: false, error, message };
  }
  void o.sync?.();
  const message = typeof o.success === "function" ? o.success(value, ...args) : o.success;
  const icon = typeof o.successIcon === "function" ? o.successIcon(value, ...args) : o.successIcon;
  const undo = o.undo;
  if (message && undo) {
    env.notify("info", message, {
      icon,
      action: {
        label: env.undoLabel,
        onClick: () =>
          void (async () => {
            try {
              await undo(value, ...args);
            } catch {
              env.notify("error", env.undoFailed);
              return;
            }
            rollback?.();
            void o.sync?.();
          })(),
      },
    });
  } else if (message) env.notify("success", message, icon ? { icon } : undefined);
  return { ok: true, value };
}
