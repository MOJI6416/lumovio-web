"use client";

import { CloudOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * The API didn't answer while the person may well be signed in (SH-03, design system 8.5): say so and
 * offer Retry, never the sign-in page. Retry renders the page again on the server.
 */
export function ServiceUnavailable() {
  const t = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ErrorState
      variant="page"
      icon={CloudOff}
      title={t("unavailableTitle")}
      text={t("unavailableText")}
      onRetry={() => start(() => router.refresh())}
      retrying={pending}
    />
  );
}
