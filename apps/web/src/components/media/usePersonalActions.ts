"use client";

import type { ListSummary, MediaKind, TitleLibraryState } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/providers/Providers";
import type { GateReason, GuestIntent } from "@/components/shell/GuestGate";
import type { ToastOptions } from "@/components/ui/toast-store";
import { libraryKey, useLibraryState, useSetLibraryState } from "@/hooks/useLibraryState";
import { getPathname } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { trackOutcome } from "@/lib/discovery-metrics";
import { titleHref } from "@/lib/slug";
import { useAction } from "@/lib/use-action";
import { sharePage } from "@/components/share/share";

/*
 * The personal actions on a title — one set of requests, on-screen changes, toasts and "Undo" for
 * the title page's actions (title/TitleActions) and a card's "More" menu (media/CardMenu). The rating and following a
 * series stay with the title page.
 */

/** Why a title is "Not interested" (recommendations learn from it). */
export type HideReason = "seen" | "genre" | "title";

/** What the actions need of a title (a TitleSummary or TitleDetails fits). */
export interface ActionTitle {
  id: string;
  kind: MediaKind;
  tmdbId: number;
  title: string;
}

/** Which sign-in sheet a guest's press opens, and the action to finish after signing in. */
const GATE_OF: Record<string, [GateReason, GuestIntent["action"]?]> = {
  wl: ["watchlist", "watchlist"],
  fav: ["favorite", "favorite"],
  w: ["watched", "watched"],
  rate: ["rate", "rate"],
};

/** One change of a title's library state: the request, what the screen shows at once, and how it is taken back. */
export interface LibraryChange {
  key: string;
  run: () => Promise<TitleLibraryState>;
  optimistic?: Partial<TitleLibraryState>;
  /** A change elsewhere on the screen (a card leaving its shelf); returns how to put it back. */
  // biome-ignore lint/suspicious/noConfusingVoidType: a change that needs no putting back returns nothing
  also?: () => (() => void) | void;
  /** The toast, for changes that are taken back with "Undo"; none where the control shows the result. */
  success?: string;
  /** The toast's mark of the confirmed action. */
  icon?: ToastOptions["icon"];
  undo?: () => Promise<unknown>;
  /** The failure's own words, where the general ones would mislead; and "Retry" in its toast. */
  error?: string;
  retry?: () => void;
}

/** The profile's own lists a title can be added to (owner or editor), loaded when a list picker is shown. */
export function useEditableLists(enabled: boolean) {
  const { me } = useSession();
  return useQuery({
    queryKey: ["lists"],
    queryFn: () => api<{ lists: ListSummary[] }>("/api/lists"),
    enabled: enabled && Boolean(me?.activeProfile),
    select: (r) => r.lists.filter((l) => l.kind === "custom" && (l.role === "owner" || l.role === "editor")),
  });
}

export function usePersonalActions(t: ActionTitle) {
  const tt = useTranslations("title");
  const tr = useTranslations();
  const tg = useTranslations("shell.gate");
  const locale = useLocale();
  const { me } = useSession();
  const qc = useQueryClient();
  const setState = useSetLibraryState();
  const { data: state } = useLibraryState(t.id);
  const signedIn = Boolean(me?.activeProfile);
  const [busy, setBusy] = useState<string | null>(null);

  // A guest's personal action opens the sign-in sheet named after it, and is done after signing in.
  const [gate, setGate] = useState<{ open: boolean; reason: GateReason; intent?: GuestIntent }>({ open: false, reason: "watchlist" });
  const requireAuth = (reason: GateReason, action?: GuestIntent["action"]) => setGate({ open: true, reason, intent: action && { titleId: t.id, action } });

  // Every personal action: the control changes at once, a failure puts it back with a toast in words, and the
  // reversible ones (Favourites, Watched, Not interested) offer "Undo".
  const change = useAction({
    run: async (c: LibraryChange) => {
      const s = await c.run();
      setState(s);
      return s;
    },
    optimistic: (c) => {
      const prev = qc.getQueryData<TitleLibraryState | null>(libraryKey(t.id));
      if (prev && c.optimistic) setState({ ...prev, ...c.optimistic });
      const restore = c.also?.();
      return () => {
        if (prev) setState(prev);
        restore?.();
      };
    },
    success: (_s, c) => c.success ?? null,
    successIcon: (_s, c) => c.icon,
    undo: (_s, c) => c.undo?.() ?? Promise.resolve(),
    error: (_e, c) => c.error,
    errorAction: (_e, c) => (c.retry ? { label: tr("common.retry"), onClick: c.retry } : undefined),
  });
  /** Its result (whether the server said yes); nothing for a guest, who is asked to sign in first. */
  async function mutate(c: LibraryChange) {
    if (!signedIn) {
      const [reason, action] = GATE_OF[c.key] ?? ["list"];
      requireAuth(reason, action);
      return undefined;
    }
    setBusy(c.key);
    const result = await change.run(c);
    setBusy(null);
    return result;
  }

  const inWatchlist = state?.inWatchlist ?? false;
  const isFavorite = state?.isFavorite ?? false;
  const watched = (state?.watchedCount ?? 0) > 0;
  const hidden = state?.feedback === "hide";

  const watchlistRequest = (on: boolean) => api<TitleLibraryState>("/api/library/watchlist", { method: "POST", json: { titleId: t.id, on } });
  const favoriteRequest = (on: boolean) => api<TitleLibraryState>("/api/library/favorites", { method: "POST", json: { titleId: t.id, on } });
  const watchedRequest = (on: boolean) => api<TitleLibraryState>("/api/history/mark", { method: "POST", json: { titleId: t.id, watched: on } });
  const hideRequest = (on: boolean, reason?: HideReason) =>
    api<TitleLibraryState>("/api/recommendations/feedback", { method: "POST", json: { titleId: t.id, kind: "hide", on, ...(reason ? { reason } : {}) } });

  /** "Watchlist": the control shows the result, no toast; `announce` adds the toast with Undo (after signing in). */
  const setWatchlist = (on: boolean, announce = false) => {
    // An add counts for the shelf the title was opened from (anonymous).
    if (on && signedIn) trackOutcome(t.id, "watchlist");
    return mutate({
      key: "wl",
      run: () => watchlistRequest(on),
      optimistic: { inWatchlist: on },
      ...(on && announce ? { success: tg("doneWatchlist"), undo: () => watchlistRequest(false) } : {}),
    });
  };
  const setFavorite = (on: boolean) =>
    mutate({ key: "fav", run: () => favoriteRequest(on), optimistic: { isFavorite: on }, ...(on ? { success: tt("favoriteAdded"), icon: "favourite", undo: () => favoriteRequest(false) } : {}) });
  /** Films only: a series is marked by its episodes (the title's "Episodes" tab). */
  const setWatched = (on: boolean) => mutate({ key: "w", run: () => watchedRequest(on), ...(on ? { success: tt("watchedMarked"), undo: () => watchedRequest(false) } : {}) });
  /**
   * "Not interested": out of "For you" and the discovery shelves; `also` takes the card off its shelf at once. The
   * reason, when the profile gave one, teaches recommendations (already seen; not my genre; not this title).
   */
  const setHidden = (on: boolean, also?: LibraryChange["also"], reason?: HideReason) =>
    mutate({
      key: "hide",
      run: () => hideRequest(on, reason),
      optimistic: { feedback: on ? "hide" : null },
      also: on ? also : undefined,
      ...(on ? { success: tr("rows.forYouHidden", { title: t.title }), undo: () => hideRequest(false) } : {}),
    });

  const freshState = async () => (await api<{ states: TitleLibraryState[] }>(`/api/library/state?ids=${t.id}`)).states[0]!;
  const toggleList = (listId: string) => {
    const inList = state?.listIds.includes(listId) ?? false;
    return mutate({
      key: `list-${listId}`,
      run: async () => {
        if (inList) await api(`/api/lists/${listId}/items/${t.id}`, { method: "DELETE" });
        else await api(`/api/lists/${listId}/items`, { method: "POST", json: { titleId: t.id } });
        void qc.invalidateQueries({ queryKey: ["lists"] });
        return freshState();
      },
      optimistic: state ? { listIds: inList ? state.listIds.filter((x) => x !== listId) : [...state.listIds, listId] } : undefined,
    });
  };
  /**
   * After "New list" in the picker: the title goes into it, said in a toast with "Undo" — the picker is
   * closed by then, so the check box is not there to show it. "Undo" takes the title out; the new list stays. If the
   * title can't be added, the toast says the list is there all the same, with "Retry".
   */
  const addToNewList = (l: ListSummary): Promise<void> =>
    mutate({
      error: tt("addToNewListFailed", { list: l.name }),
      retry: () => void addToNewList(l),
      key: `list-${l.id}`,
      run: async () => {
        await api(`/api/lists/${l.id}/items`, { method: "POST", json: { titleId: t.id } });
        void qc.invalidateQueries({ queryKey: ["lists"] });
        return freshState();
      },
      success: tt("addedToList", { list: l.name }),
      undo: async () => {
        await api(`/api/lists/${l.id}/items/${t.id}`, { method: "DELETE" });
        void qc.invalidateQueries({ queryKey: ["lists"] });
        setState(await freshState());
      },
    }).then(() => undefined);

  /** The system share sheet on a touch device, Lumovio's own on a computer (components/share). */
  const share = () =>
    sharePage({ title: t.title, url: new URL(getPathname({ href: titleHref(t.kind, t.tmdbId, t.title), locale }), window.location.origin).toString() });

  /**
   * What a guest pressed before signing in, done once they are back (GuestGate), with the usual toast and Undo.
   * Returns false for the actions the caller does itself (rating, following).
   */
  const replay = (action: GuestIntent["action"]): boolean => {
    if (action === "watchlist") {
      if (!inWatchlist) void setWatchlist(true, true);
    } else if (action === "favorite") {
      if (!isFavorite) void setFavorite(true);
    } else if (action === "watched") {
      if (t.kind === "movie" && !watched) void setWatched(true);
    } else return false;
    return true;
  };

  return {
    state,
    signedIn,
    busy,
    /** Any other library change under the same rules (the title page's rating). */
    mutate,
    inWatchlist,
    isFavorite,
    watched,
    hidden,
    setWatchlist,
    setFavorite,
    setWatched,
    setHidden,
    toggleList,
    addToNewList,
    share,
    replay,
    requireAuth,
    /** Props of the sign-in sheet (GuestGate) to render beside the controls. */
    gate: { ...gate, onOpenChange: (open: boolean) => setGate((g) => ({ ...g, open })) },
  };
}
