"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { TvButton } from "@/components/ui/tv/TvButton";
import { useTvNav } from "../nav/TvNav";

/** "Back" on a screen: the remote's Back as a button, for a pointer and for a screen with nothing else to press. */
export function TvBackButton({ initial }: { initial?: boolean }) {
  const t = useTranslations("common");
  const { back } = useTvNav();
  return (
    <TvButton icon={ArrowLeft} data-tv-initial={initial || undefined} onClick={back}>
      {t("back")}
    </TvButton>
  );
}
