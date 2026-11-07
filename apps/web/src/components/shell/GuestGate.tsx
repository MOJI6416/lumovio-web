"use client";

import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type ReactNode, type Ref, useRef } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link, usePathname } from "@/i18n/navigation";

/*
 * One way in for a guest (design-system 8.6, audit AUTH-02): whatever needs an account — a personal action on a title,
 * playback, describing a film in words, a closed list, an invitation — says what it was for, offers "Sign in" and
 * "Create account", and brings the person back to the same page. A personal action on a title is remembered on this
 * device (GuestIntent) and done once they are back on that title signed in.
 */

export type GateReason = "watchlist" | "favorite" | "rate" | "watched" | "list" | "saveList" | "follow" | "watch" | "ai" | "listOpen" | "invite";

/** A title action to finish after signing in. */
export interface GuestIntent {
  titleId: string;
  action: "watchlist" | "favorite" | "rate" | "watched" | "follow";
}

const INTENT_KEY = "lumovio:guest-intent";
// Long enough for sign-up and the confirmation e-mail; an older intent is dropped, not done by surprise.
const INTENT_TTL = 30 * 60 * 1000;

function saveIntent(intent: GuestIntent) {
  try {
    localStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, at: Date.now() }));
  } catch {
    // No storage (private mode): the person still comes back to the page, only the action isn't redone.
  }
}

/** The action a guest started on this title before signing in, once (it is forgotten as it is read). */
export function takeGuestIntent(titleId: string): GuestIntent["action"] | null {
  try {
    const raw = localStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as GuestIntent & { at: number };
    if (Date.now() - saved.at > INTENT_TTL) {
      localStorage.removeItem(INTENT_KEY);
      return null;
    }
    if (saved.titleId !== titleId) return null;
    localStorage.removeItem(INTENT_KEY);
    return saved.action;
  } catch {
    return null;
  }
}

/** "Sign in" and "Create account" addresses that bring the person back here (with the query), or to `next`. */
export function useSignInLinks(next?: string) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const to = next ?? (query ? `${pathname}?${query}` : pathname);
  const q = to === "/" ? "" : `?next=${encodeURIComponent(to)}`;
  return { signIn: `/auth/sign-in${q}`, signUp: `/auth/sign-up${q}` };
}

const PERSONAL = new Set<GateReason>(["watchlist", "favorite", "rate", "watched", "list", "saveList", "follow"]);
const textKey = (r: GateReason) => (PERSONAL.has(r) ? "personal" : r);

/**
 * "Sign in" and "Create account", back to this page. `lead` is the main one (primary): "Sign in" where something was
 * asked for, "Create account" in the home page's welcome. In a dialog the main action is last, on the right (7.1); in
 * a page or a panel it comes first.
 */
export function GuestGateLinks({
  next,
  intent,
  signInRef,
  inDialog = false,
  lead = "signIn",
}: {
  next?: string;
  intent?: GuestIntent;
  signInRef?: Ref<HTMLAnchorElement>;
  inDialog?: boolean;
  lead?: "signIn" | "signUp";
}) {
  const tc = useTranslations("common");
  const hrefs = useSignInLinks(next);
  const remember = () => {
    if (intent) saveIntent(intent);
  };
  const signIn = (
    <Link key="in" ref={signInRef} href={hrefs.signIn} onClick={remember} className={buttonClass(lead === "signIn" ? "primary" : "secondary")}>
      {tc("signIn")}
    </Link>
  );
  const signUp = (
    <Link key="up" href={hrefs.signUp} onClick={remember} className={buttonClass(lead === "signUp" ? "primary" : "secondary")}>
      {tc("signUp")}
    </Link>
  );
  const [main, other] = lead === "signIn" ? [signIn, signUp] : [signUp, signIn];
  return <>{inDialog ? [other, main] : [main, other]}</>;
}

/** Examples of a description, so a guest sees what "describe it" means before signing in (SRCH-03). */
function AiExamples() {
  const t = useTranslations("shell.gate");
  return (
    <div className="text-start">
      <p className="text-body-s font-semibold text-text-2">{t("aiExamples")}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {(["aiExample1", "aiExample2", "aiExample3"] as const).map((k) => (
          <li key={k} className="rounded-sm bg-surface-2 px-3 py-2 text-body text-text-1">
            «{t(k)}»
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The sign-in sheet (a dialog on a tablet and desktop): open it where a guest presses something that needs an account.
 * `intent` — a title action to finish after signing in; `next` — where to return (this page by default). The title says
 * what it is for; its explanation is the layer's description for a screen reader only (no visible explanations, 1.2).
 */
export function GuestGate({
  open,
  onOpenChange,
  trigger,
  reason,
  next,
  intent,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  reason: GateReason;
  next?: string;
  intent?: GuestIntent;
}) {
  const t = useTranslations("shell.gate");
  const signIn = useRef<HTMLAnchorElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      size="sm"
      title={t(reason)}
      description={<span className="sr-only">{t(`${textKey(reason)}Text`)}</span>}
      initialFocus={signIn}
    >
      {reason === "ai" && <AiExamples />}
      <DialogActions className={reason === "ai" ? undefined : "mt-2"}>
        <GuestGateLinks next={next} intent={intent} signInRef={signIn} inDialog />
      </DialogActions>
    </Dialog>
  );
}

/**
 * The same invitation inside a page's section (AI search; design-system 7.11 "Доступ"): the state's layout with the
 * reason as the question, "Sign in" and "Create account"; what comes after is for a screen reader. A whole page that
 * needs an account is library/SignInColumn.
 */
export function GuestGatePanel({ reason, next }: { reason: GateReason; next?: string }) {
  const t = useTranslations("shell.gate");
  return (
    <EmptyState icon={LogIn} title={t(reason)} about={t(`${textKey(reason)}Text`)} action={<GuestGateLinks next={next} />}>
      {reason === "ai" && (
        <div className="mt-6 w-full max-w-md">
          <AiExamples />
        </div>
      )}
    </EmptyState>
  );
}
