import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/Toast";
import { type ActionEnv, type ActionOptions, runAction } from "./action";
import { ApiRequestError } from "./api";
import { apiErrorKey } from "./api-errors";
import { safeNext } from "./safe-next";

export type { ActionEnv, ActionOptions, ActionResult } from "./action";

/*
 * Every user action that changes data goes through one helper:
 * pending → success (a visible change and/or a toast, with "Undo" when it can be taken back) → or failure (the
 * optimistic change rolled back and a toast in words from lib/api-errors). A failure is never swallowed and success
 * is never shown for a request that failed.
 *
 *   const remove = useAction({
 *     run: (e: Entry) => api(`/api/history/${e.id}`, { method: "DELETE" }),
 *     optimistic: (e) => { hide(e.id); return () => unhide(e.id); },     // on screen within 100 ms; how to put it back
 *     success: (_, e) => t("entryRemoved", { title: e.title }),
 *     undo: (_, e) => api(`/api/history/${e.id}/restore`, { method: "POST", json: {} }),
 *     error: (_, e) => t("entryRemoveFailed", { title: e.title }),    // optional: the API error's words otherwise
 *     sync: () => qc.invalidateQueries({ queryKey: ["history"] }),
 *   });
 *   <Button loading={remove.pending} onClick={() => void remove.run(entry)}>…</Button>
 *
 * Instead of `.catch(() => {})`: `await act.run()` resolves `{ ok, value | error }` and never throws. The rules
 * themselves (no React) are in ./action.
 */

const notify: ActionEnv["notify"] = (tone, message, options) => toast[tone](message, options);

/**
 * Sign in again and come back to this very page (with its query): the address for "Sign in" in the toast of an action
 * refused because the session ended (`unauthorized`).
 */
export function signInAgainHref(locale: string) {
  const next = safeNext(`${window.location.pathname}${window.location.search}`);
  return `${locale === "en" ? "" : `/${locale}`}/auth/sign-in${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`;
}

function useActionEnv(silent = false): ActionEnv {
  const t = useTranslations();
  const locale = useLocale();
  return {
    notify: silent ? () => {} : notify,
    errorMessage: (e) => t(apiErrorKey(e)),
    undoLabel: t("common.undo"),
    undoFailed: t("common.undoFailed"),
    // The session ended: "Sign in to do this" with "Sign in" that brings the person back here.
    errorAction: (e) =>
      e instanceof ApiRequestError && e.code === "unauthorized"
        ? { label: t("common.signIn"), onClick: () => window.location.assign(signInAgainHref(locale)) }
        : undefined,
  };
}

/** `run(...args)` performs the action under the 8.3 rules; `pending` while one is running. */
export function useAction<A extends unknown[], R>(options: ActionOptions<A, R>) {
  const env = useActionEnv();
  const [count, setCount] = useState(0);
  // The latest options and words, so `run` keeps one identity and still sees the current state.
  const latest = useRef({ options, env });
  useLayoutEffect(() => {
    latest.current = { options, env };
  });
  const run = useCallback(async (...args: A) => {
    setCount((n) => n + 1);
    try {
      return await runAction(latest.current.options, args, latest.current.env);
    } finally {
      setCount((n) => n - 1);
    }
  }, []);
  return { run, pending: count > 0 };
}

/** The save state of a settings section, shown by SettingsSection. */
export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string; retry: () => void };

/**
 * Settings that apply at once: `save(request, optimistic?)` changes the screen, sends the request, shows
 * "Saved" by the section's title for a moment; on failure rolls back and leaves the error in the section
 * (InlineAlert with "Retry"), not a toast.
 */
export function useSettingsSave(savedForMs = 2500) {
  const env = useActionEnv(true);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const envRef = useRef(env);
  useLayoutEffect(() => {
    envRef.current = env;
  });
  const save = useCallback(
    async function save(
      request: () => Promise<unknown>,
      // biome-ignore lint/suspicious/noConfusingVoidType: as ActionOptions.optimistic
      optimistic?: () => (() => void) | undefined | void,
    ): Promise<boolean> {
      clearTimeout(timer.current);
      setState({ status: "saving" });
      const r = await runAction({ run: request, optimistic }, [], envRef.current);
      if (r.ok) {
        setState({ status: "saved" });
        timer.current = setTimeout(() => setState({ status: "idle" }), savedForMs);
      } else setState({ status: "error", message: r.message, retry: () => void save(request, optimistic) });
      return r.ok;
    },
    [savedForMs],
  );
  return { state, save };
}
