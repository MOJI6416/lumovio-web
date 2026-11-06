"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * A form with typed changes that aren't saved yet (design-system 8.8, audit SET-01): leaving the page asks first
 * instead of dropping them. Closing or reloading the tab gets the browser's own question (`beforeunload`); a link
 * inside the site gets ours — "Leave without saving?" with "Stay" as the safe choice.
 */
export function useUnsavedChanges(dirty: boolean) {
  const t = useTranslations("settings");
  const confirm = useConfirm();
  const router = useRouter();
  const asking = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      // Before the link's own handler (React listens at the root, this at the document in the capture phase).
      // Immediate: another form of the page with its own changes doesn't ask a second time.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (asking.current) return;
      asking.current = true;
      void confirm({
        title: t("unsavedTitle"),
        text: t("unsavedText"),
        confirmLabel: t("unsavedLeave"),
        cancelLabel: t("unsavedStay"),
      }).then((leave) => {
        asking.current = false;
        if (leave) router.push(`${to.pathname}${to.search}${to.hash}`);
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, confirm, router, t]);
}

/**
 * A settings dialog that is a form with "Save" (design-system 8.8): closing it — ×, Escape, a click outside, "Cancel" —
 * with typed changes asks first, "Close without saving?" with "Keep editing" as the safe choice; leaving the page asks
 * as `useUnsavedChanges` does. Returns the close to give the dialog's `onOpenChange` and its "Cancel".
 */
export function useDiscardGuard(dirty: boolean, close: () => void) {
  const t = useTranslations("settings");
  const confirm = useConfirm();
  useUnsavedChanges(dirty);
  return async () => {
    if (!dirty) return close();
    const discard = await confirm({
      title: t("discardTitle"),
      text: t("discardText"),
      confirmLabel: t("discard"),
      cancelLabel: t("keepEditing"),
    });
    if (discard) close();
  };
}
