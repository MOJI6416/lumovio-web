"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsSave } from "@/lib/use-action";

/**
 * The account's preferences (/api/preferences). `discord` is the connected channel's webhook by its name in Discord
 * (its address never comes back).
 */
export type Prefs = {
  aiHistoryOptIn: boolean;
  emailNotifications: boolean;
  discordNotifications: boolean;
  discord?: { name: string } | null;
  /** Mail to the account's address bounced for good or was marked as spam: the API switched mail off. */
  emailBounce?: { reason: "bounced" | "complained"; at: string } | null;
};

/**
 * The preferences and a setter that applies at once (8.8): the switch moves, "Saved" shows by the section's title,
 * a refusal puts it back and stays in the section with "Retry" (SET-02).
 */
export function usePrefs() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["prefs"], queryFn: () => api<Prefs>("/api/preferences") });
  const { state, save } = useSettingsSave();
  const set = (patch: Partial<Prefs>) =>
    void save(
      () => api("/api/preferences", { method: "PUT", json: patch }),
      () => {
        const before = qc.getQueryData<Prefs>(["prefs"]);
        // Switching mail on again clears the bounce mark (the API does the same).
        qc.setQueryData<Prefs>(["prefs"], (d) => d && { ...d, ...patch, ...(patch.emailNotifications ? { emailBounce: null } : {}) });
        return () => qc.setQueryData(["prefs"], before);
      },
    );
  return { query, set, state };
}
