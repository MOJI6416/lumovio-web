"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { Button, buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";

/**
 * The Anime section of a profile with anime off (design-system 8.14; an old link, a bookmark): says so, and an adult
 * turns it on right here — the section then opens in its place. A kids profile is told an adult can (in Manage profiles).
 */
export function AnimeOff() {
  const t = useTranslations("browse");
  const tp = useTranslations("profiles");
  const { me } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const profile = me?.activeProfile;
  const kids = Boolean(profile?.isKids);
  const turnOn = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await api(`/api/profiles/${profile.id}`, { method: "PATCH", json: { showAnime: true } });
      // The page and the header read the profile from the session: the section takes this page's place.
      router.refresh();
    } catch {
      setBusy(false);
      toast.error(t("animeOnFailed"));
    }
  };
  const home = (
    <Link href="/" className={buttonClass(kids ? "primary" : "tertiary")}>
      {tp("toHome")}
    </Link>
  );
  return (
    <EmptyState
      icon={Sparkles}
      title={t("animeOffTitle")}
      text={kids ? `${t("animeOffText")} ${t("animeOffKids")}` : t("animeOffText")}
      action={
        kids ? (
          home
        ) : (
          <Button loading={busy} onClick={() => void turnOn()}>
            {t("animeOn")}
          </Button>
        )
      }
      secondaryAction={kids ? undefined : home}
    />
  );
}
