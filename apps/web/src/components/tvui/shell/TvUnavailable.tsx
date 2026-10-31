"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { TvButton } from "@/components/ui/tv/TvButton";
import { TvState } from "./TvState";

/** The API didn't answer (SH-03, 8.5): said so with Retry, never the code screen as if signed out. */
export function TvUnavailable() {
  const t = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div data-tv-screen="home" data-tv-main className="grid h-full place-items-center p-16">
      <TvState icon={CloudOff} title={t("unavailableTitle")} text={t("unavailableText")}>
        <TvButton
          icon={RefreshCw}
          loading={pending}
          data-tv-initial
          onClick={() => start(() => router.refresh())}
        >
          {tc("retry")}
        </TvButton>
      </TvState>
    </div>
  );
}
