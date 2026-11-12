"use client";

import { CircleAlert, Info, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ActionMark, SavedCheck } from "./BrandMotion";
import { Button } from "./Button";
import { cn } from "./cn";
import { confirmQueue } from "./confirm-queue";
import { IconButton } from "./IconButton";
import { markToastPress, TOAST_REGION_ATTR } from "./layers";
import { OfflineNotice } from "./OfflineNotice";
import { type ToastAction, type ToastItem, type ToastOptions, toastStore } from "./toast-store";

export type { ToastAction, ToastOptions } from "./toast-store";

// The confirmation dialog (Radix Dialog, fields) loads only once something asks for a confirmation, so the
// Toaster on every page stays light (bundle budget).
const ConfirmHost = dynamic(() => import("./ConfirmFrame").then((m) => m.ConfirmHost), { ssr: false });
const hasPending = () => confirmQueue.get().length > 0;

function LazyConfirmHost() {
  const pending = useSyncExternalStore(confirmQueue.subscribe, hasPending, () => false);
  return pending ? <ConfirmHost /> : null;
}

/** The old second argument of `toast.info(message, action)`, still accepted. */
const options = (o: ToastOptions | ToastAction | undefined): ToastOptions =>
  o && "onClick" in o ? { action: o } : (o ?? {});

/**
 * Toasts: for a result that isn't visible where it happened, or to offer "Undo".
 * Any tone takes one action: `toast.success(message, { action: { label, onClick } })`; `toast.info(message, action)`
 * still works. Rules (4 s / 7 s, at most 3, pause on hover and focus) live in ./toast-store. Returns the id for
 * `toast.dismiss(id)`. The message is already translated; an API error goes through lib/api-errors first.
 */
export const toast = {
  success: (message: string, o?: ToastOptions | ToastAction) =>
    toastStore.push("success", message, options(o)),
  error: (message: string, o?: ToastOptions | ToastAction) => toastStore.push("error", message, options(o)),
  info: (message: string, o?: ToastOptions | ToastAction) => toastStore.push("info", message, options(o)),
  dismiss: (id: number) => toastStore.dismiss(id),
};

const EMPTY: ToastItem[] = [];

const ICON = {
  // The tick draws itself: a success toast comes once the server has confirmed.
  success: <SavedCheck />,
  error: <CircleAlert aria-hidden className="size-5 shrink-0 text-danger" />,
  // Neutral: no blue.
  info: <Info aria-hidden className="size-5 shrink-0 text-text-2" />,
} as const;

/** One toast: status icon, one line, the action, the close button. Shown by Toaster; the showcase draws it too. */
export function ToastCard({
  item,
  onAction,
  onDismiss,
}: {
  item: Omit<ToastItem, "id">;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const tc = useTranslations("common");
  return (
    // On a phone the action goes under the message (at the end), so a long line isn't squeezed into a column.
    <div
      className={cn(
        "pointer-events-auto grid w-full max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 material rounded-lg py-2 ps-4 pe-2 text-body text-text-1 transition-[opacity,translate] duration-base ease-base starting:translate-y-2 starting:opacity-0",
        item.action && "sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
      )}
    >
      {item.icon ? <ActionMark kind={item.icon} /> : ICON[item.tone]}
      <p className="py-1">{item.message}</p>
      {item.action && (
        <div className="max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:justify-self-end">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {item.action.label}
          </Button>
        </div>
      )}
      <IconButton
        icon={X}
        label={tc("dismiss")}
        size="sm"
        onClick={onDismiss}
        className="max-sm:col-start-3 max-sm:row-start-1"
      />
    </div>
  );
}

/**
 * Shows the queue at the bottom centre — on a phone above the tab bar — in one polite live region (it stays readable
 * while a modal dialog is open). Also hosts the confirmations of `useConfirm`/`usePrompt` (./ConfirmDialog; the
 * dialog is ./ConfirmFrame), so one mount in the providers serves both.
 */
export function Toaster() {
  const t = useTranslations("ui");
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => EMPTY);
  const region = useRef<HTMLElement>(null);

  // A toast removed under the pointer or with the focus in it fires no leave/blur: let the timers go on.
  useEffect(() => {
    if (items.length === 0) toastStore.release("hover");
    if (!region.current?.contains(document.activeElement)) toastStore.release("focus");
  }, [items]);

  return (
    <>
      <section
        ref={region}
        {...{ [TOAST_REGION_ATTR]: "" }}
        aria-live="polite"
        aria-label={t("notifications")}
        onPointerDownCapture={(e) => markToastPress(e.nativeEvent)}
        onPointerEnter={() => toastStore.hold("hover")}
        onPointerLeave={() => toastStore.release("hover")}
        onFocus={() => toastStore.hold("focus")}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) toastStore.release("focus");
        }}
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-toast flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onAction={() => toastStore.act(item.id)}
            onDismiss={() => toastStore.dismiss(item.id)}
          />
        ))}
        <OfflineNotice />
      </section>
      <LazyConfirmHost />
    </>
  );
}
