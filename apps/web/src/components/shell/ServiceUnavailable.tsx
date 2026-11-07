"use client";

import { CloudOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * The API didn't answer while the person may well be signed in (SH-03, design system 7.11, 8.5): "Lumovio is
 * unavailable" and Retry, never the sign-in page; "you're still signed in" is for a screen reader. Retry renders the
 * page again on the server. `section` under the page's own header (Settings, Library, Calendar…); `page` where nothing
 * else stands (the home page, a title).
 */
export function ServiceUnavailable({ variant = "section" }: { variant?: "page" | "section" }) {
  const t = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ErrorState
      variant={variant}
      icon={CloudOff}
      title={t("unavailableTitle")}
      about={t("unavailableText")}
      details={null}
      onRetry={() => start(() => router.refresh())}
      retrying={pending}
    />
  );
}
