"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useState } from "react";
import { confirmQueue } from "./confirm-queue";
import { isOnStage, layerOrigin, usePortalContainer } from "./portal";

/*
 * Confirmation of the irreversible (design-system 7.9, 8.3; audit X-12): the title asks the question with the object
 * («Удалить список «Ужасы 80-х»?»), the text says what changes and what stays, then "Cancel" and the main button
 * with the same verb («Удалить список»). The most dangerous ones (the account) ask to type a word or the name first.
 * Reversible actions don't ask: they offer "Undo" in a toast (lib/use-action).
 *
 * Instead of window.confirm / window.prompt:
 *   const confirm = useConfirm();
 *   if (await confirm({ title, text, confirmLabel })) …            // resolves true / false
 *   await confirm({ title, text, confirmLabel, action: () => api(…), error: t("deleteListFailed") })
 *                                                                   // runs it in the dialog: spinner, error inside
 *   const prompt = usePrompt();
 *   const reason = await prompt({ title, label, confirmLabel });    // the text, or null when cancelled
 * A declarative <ConfirmDialog open onOpenChange onConfirm …/> is there for a dialog that a screen already keeps
 * in its state.
 *
 * This module is light on purpose (hooks, types, a queue): the dialog — Radix Dialog, fields, alerts — is in
 * ./ConfirmFrame and loads the first time something asks (the host in <Toaster />, or this ConfirmDialog).
 */

export interface ConfirmOptions {
  /** A question with the object. */
  title: string;
  /** What changes and what stays; read out with the title. */
  text?: ReactNode;
  /** The same verb as the action: "Delete list", "Remove server". */
  confirmLabel: string;
  /** "Cancel" by default. */
  cancelLabel?: string;
  /** `danger` (default) for deleting; `primary` for a confirmation that destroys nothing. */
  tone?: "danger" | "primary";
  /** The most dangerous actions: the button waits until this word or name is typed (case does not matter). */
  confirmWord?: string;
  /** Runs inside the dialog: the button spins, a failure is shown in the dialog and it stays open. */
  action?: () => Promise<unknown>;
  /**
   * The words of a failed `action` in the dialog, as useAction's `error` («Не удалось удалить список. Повторите
   * попытку»); by default the translated API error («Нет соединения…»).
   */
  error?: string | ((error: unknown) => string);
}

export interface PromptOptions {
  title: string;
  text?: ReactNode;
  /** The field's label: "Reason". */
  label: string;
  placeholder?: string;
  defaultValue?: string;
  /** The button waits for some text; true by default. */
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  action?: (value: string) => Promise<unknown>;
  /** The words of a failed `action`; the translated API error by default. */
  error?: string | ((error: unknown, value: string) => string);
}

/** One queued question, shown by ConfirmHost (./ConfirmFrame). */
export type ConfirmRequest = { id: number; container: HTMLElement | null; stage: boolean } & (
  | { kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void }
);

type Ask = { kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void } | {
  kind: "prompt";
  options: PromptOptions;
  resolve: (value: string | null) => void;
};

let seq = 0;

function ask(request: Ask, container: HTMLElement | null) {
  // Where it was asked from decides the stage: by the time the dialog loads, the focus may have moved.
  const req: ConfirmRequest = { ...request, id: ++seq, container, stage: isOnStage(layerOrigin()) };
  confirmQueue.push(req);
}

/** `await confirm({ title, text, confirmLabel })` → true when confirmed (and `action`, if any, succeeded). */
export function useConfirm() {
  const container = usePortalContainer() ?? null;
  return useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => ask({ kind: "confirm", options, resolve }, container)),
    [container],
  );
}

/** `await prompt({ title, label, confirmLabel })` → the typed text (trimmed), or null when cancelled. */
export function usePrompt() {
  const container = usePortalContainer() ?? null;
  return useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => ask({ kind: "prompt", options, resolve }, container)),
    [container],
  );
}

const Frame = dynamic(() => import("./ConfirmFrame").then((m) => m.ConfirmDialogFrame), { ssr: false });

/**
 * A confirmation kept in a screen's own state. `onConfirm` may return a promise: the dialog waits and shows a failure
 * (in the words of `error`, if given). The dialog's code loads the first time it opens.
 */
export function ConfirmDialog(
  props: Omit<ConfirmOptions, "action"> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => unknown;
  },
) {
  // Kept once opened, so closing runs the dialog's own focus return.
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true);
  return used ? <Frame {...props} /> : null;
}
