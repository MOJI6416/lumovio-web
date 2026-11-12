"use client";

import type { RecommendationPrefs } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/Providers";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

const KEY = ["recommendation-settings"];

/**
 * "Don't show in recommendations" on a person's page: the same list as Settings → Recommendations
 * → "Don't show" → People, so titles with this person stay out of the profile's picks. Changes at once, with "Undo";
 * shown only to a signed-in profile (a guest has no picks). One quiet button under the biography whose words say the
 * state: "Don't show in recommendations", once pressed "Show in recommendations".
 */
export function PersonMute({ id, name }: { id: number; name: string }) {
  const t = useTranslations("person");
  const { me } = useSession();
  const qc = useQueryClient();
  const signedIn = Boolean(me?.activeProfile);
  const prefs = useQuery({ queryKey: KEY, queryFn: () => api<RecommendationPrefs>("/api/recommendations/settings"), enabled: signedIn });
  const save = (mutedPeople: RecommendationPrefs["mutedPeople"]) => api<RecommendationPrefs>("/api/recommendations/settings", { method: "PUT", json: { mutedPeople } });
  const people = prefs.data?.mutedPeople ?? [];
  const muted = people.some((p) => p.id === id);
  const toggle = useAction({
    run: async (on: boolean) => {
      const next = on ? [...people.filter((p) => p.id !== id), { id, name }] : people.filter((p) => p.id !== id);
      const r = await save(next);
      qc.setQueryData(KEY, r);
      return r;
    },
    optimistic: (on) => {
      const before = prefs.data;
      if (!before) return;
      qc.setQueryData(KEY, { ...before, mutedPeople: on ? [...people, { id, name }] : people.filter((p) => p.id !== id) });
      return () => qc.setQueryData(KEY, before);
    },
    success: (_r, on) => (on ? t("mutedToast", { name }) : null),
    undo: async () => {
      qc.setQueryData(KEY, await save(people.filter((p) => p.id !== id)));
    },
  });
  if (!signedIn || !prefs.data) return null;
  return (
    <Button variant="tertiary" size="sm" icon={muted ? Eye : EyeOff} loading={toggle.pending} onClick={() => void toggle.run(!muted)} className="-ms-3">
      {muted ? t("unmute") : t("mute")}
    </Button>
  );
}
