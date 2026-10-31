"use client";

import { useTranslations } from "next-intl";
import { InfoTip as UiInfoTip, type InfoTipContent } from "@/components/ui/InfoTip";

export type { InfoTipContent };

/**
 * The "i" next to a section's heading on the title page and the sources screen (design-system 2.5): ui/InfoTip named
 * "About “…”".
 */
export function InfoTip({ title, ...content }: InfoTipContent & { title: string }) {
  const t = useTranslations("titlePage");
  return <UiInfoTip title={title} label={t("about", { title })} {...content} />;
}
