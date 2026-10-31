"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { apiErrorKey } from "@/lib/api-errors";
import { Button } from "./Button";
import type { ConfirmOptions, ConfirmRequest, PromptOptions } from "./ConfirmDialog";
import { confirmQueue } from "./confirm-queue";
import { DialogActions } from "./Dialog";
// The full dialog at once: this module is itself loaded on demand, a second hop would only delay it.
import { Dialog } from "./DialogFrame";
import { Field } from "./Field";
import { InlineAlert } from "./InlineAlert";
import { Input, Textarea } from "./Input";
import { LayerStageContext, PortalContainerContext } from "./portal";

/*
 * The confirmation dialog itself (design-system 7.9, 8.3). Loaded only when something asks for a confirmation: the
 * hooks and types live in ./ConfirmDialog, which every screen imports, so a screen doesn't carry the dialog, its
 * fields and Radix Dialog in its first load (scripts/bundle-budget.mjs).
 */

interface FrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone: "danger" | "primary";
  confirmWord?: string;
  input?: Pick<
    PromptOptions,
    "label" | "placeholder" | "defaultValue" | "required" | "multiline" | "maxLength"
  >;
  /** Throws to keep the dialog open with the error; resolves to close it. */
  onConfirm: (value: string) => unknown;
  /** The words of a failure; the translated API error otherwise. */
  error?: string | ((error: unknown, value: string) => string);
}

export function ConfirmFrame({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel,
  cancelLabel,
  tone,
  confirmWord,
  input,
  onConfirm,
  error: errorText,
}: FrameProps) {
  const t = useTranslations();
  const [value, setValue] = useState(input?.defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const defaultValue = input?.defaultValue ?? "";
  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    setError(null);
    setBusy(false);
  }, [open, defaultValue]);

  const typed = confirmWord !== undefined || input !== undefined;
  const wordOk =
    confirmWord === undefined || value.trim().toLocaleLowerCase() === confirmWord.trim().toLocaleLowerCase();
  // A prompt's field is required unless it says `required: false`.
  const filled = !input || input.required === false || value.trim().length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!wordOk || !filled || busy) return;
    setBusy(true);
    setError(null);
    const v = value.trim();
    try {
      await onConfirm(v);
      onOpenChange(false);
    } catch (err) {
      setError(typeof errorText === "function" ? errorText(err, v) : (errorText ?? t(apiErrorKey(err))));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      // Nothing closes the dialog while its action runs.
      onOpenChange={(o) => (o || !busy) && onOpenChange(o)}
      title={title}
      description={text}
      size="sm"
      // A field first; otherwise "Cancel" for a deletion (the safe choice) and the button for the rest.
      initialFocus={typed ? fieldRef : tone === "danger" ? cancelRef : confirmRef}
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        {typed && (
          <Field
            className="mt-2"
            label={
              confirmWord !== undefined ? t("ui.typeToConfirm", { word: confirmWord }) : (input?.label ?? "")
            }
          >
            {(id, describedBy, invalid) =>
              input?.multiline ? (
                <Textarea
                  ref={fieldRef}
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={value}
                  maxLength={input.maxLength}
                  placeholder={input.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : (
                <Input
                  ref={fieldRef}
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={value}
                  maxLength={input?.maxLength}
                  placeholder={input?.placeholder}
                  autoComplete="off"
                  onChange={(e) => setValue(e.target.value)}
                />
              )
            }
          </Field>
        )}
        {error && (
          <InlineAlert tone="danger" className="mt-4">
            {error}
          </InlineAlert>
        )}
        <DialogActions>
          <Button ref={cancelRef} variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button ref={confirmRef} type="submit" variant={tone} loading={busy} disabled={!wordOk || !filled}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** The declarative <ConfirmDialog> of ./ConfirmDialog, once it has been opened. */
export function ConfirmDialogFrame({
  open,
  onOpenChange,
  onConfirm,
  tone = "danger",
  ...rest
}: Omit<ConfirmOptions, "action"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => unknown;
}) {
  return (
    <ConfirmFrame
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => onConfirm()}
      tone={tone}
      {...rest}
    />
  );
}

/** Shows queued confirmations one by one; <Toaster /> mounts it (lazily) while the queue isn't empty. */
export function ConfirmHost() {
  const queue = useSyncExternalStore(
    confirmQueue.subscribe,
    confirmQueue.get,
    confirmQueue.get,
  ) as readonly ConfirmRequest[];
  // The confirmed value of the current request (the typed text; "" for a plain confirmation), null until then.
  const confirmed = useRef<string | null>(null);
  const current = queue[0];
  if (!current) return null;

  const finish = () => {
    const value = confirmed.current;
    confirmed.current = null;
    if (current.kind === "confirm") current.resolve(value !== null);
    else current.resolve(value);
    confirmQueue.shift();
  };
  const { options } = current;
  return (
    <PortalContainerContext.Provider value={current.container}>
      {/* Asked from a stage (the sign-in wall, "Who's watching?", the player): the dialog is dark there too. */}
      <LayerStageContext.Provider value={current.stage}>
        <ConfirmFrame
          key={current.id}
          open
          onOpenChange={(open) => {
            if (!open) finish();
          }}
          title={options.title}
          text={options.text}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          tone={options.tone ?? (current.kind === "confirm" ? "danger" : "primary")}
          confirmWord={current.kind === "confirm" ? current.options.confirmWord : undefined}
          input={current.kind === "prompt" ? current.options : undefined}
          error={options.error}
          onConfirm={async (value) => {
            if (current.kind === "confirm") await current.options.action?.();
            else await current.options.action?.(value);
            confirmed.current = value;
          }}
        />
      </LayerStageContext.Provider>
    </PortalContainerContext.Provider>
  );
}
