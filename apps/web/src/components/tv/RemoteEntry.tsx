"use client";

import { Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/Providers";
import { cn } from "@/components/ui/cn";
import { groupFocusRing } from "@/components/ui/styles";
import { Tooltip } from "@/components/ui/Tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { onlineTvs, useTvs } from "./cast";

/**
 * The way to the remote without the settings (design-system 8.18, 7.19): a round `Tv` link "TV remote" in the header —
 * on a phone too, beside the account — only while a TV of the account has Lumovio open, with a lime dot while it plays
 * something. An adult profile's (the remote is an adult's, 8.10); not on the remote itself. Loaded after the page
 * (Header), so it costs no first-load JS.
 */
export default function RemoteEntry() {
  const t = useTranslations("remote");
  const { me } = useSession();
  const pathname = usePathname();
  const adult = Boolean(me?.activeProfile && !me.activeProfile.isKids);
  const tvs = useTvs();
  const online = adult ? onlineTvs(tvs.data?.devices) : [];
  if (online.length === 0 || pathname.startsWith("/remote")) return null;
  const playing = online.some((d) => d.playback?.state === "playing" || d.playback?.state === "paused");
  return (
    <Tooltip label={t("title")}>
      {/* The header search's circle beside it (IconButton secondary sm), as a link. */}
      <Link href="/remote" aria-label={playing ? `${t("title")} · ${t("nowPlaying")}` : t("title")} className="group relative inline-grid size-8 shrink-0 place-items-center rounded-full focus-visible:shadow-none focus-visible:outline-none max-sm:size-11">
        <span aria-hidden className={cn("grid size-8 place-items-center rounded-full border border-line-2 bg-surface-2 text-text-1 transition-colors duration-fast ease-fast group-hover:bg-surface-3", groupFocusRing)}>
          <Tv className="size-4" />
        </span>
        {playing && <span aria-hidden className="pointer-events-none absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-bg bg-accent max-sm:end-1 max-sm:top-1" />}
      </Link>
    </Tooltip>
  );
}
