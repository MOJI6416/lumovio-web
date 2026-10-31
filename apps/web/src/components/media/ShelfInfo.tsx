"use client";

import { useTranslations } from "next-intl";
import { InfoTip, type InfoTipContent } from "@/components/ui/InfoTip";

/** A shelf's "i" (design-system 7.13): ui/InfoTip named "How it's picked: …". */
export function ShelfInfo({ title, ...content }: InfoTipContent & { title: string }) {
  const t = useTranslations("rows");
  return <InfoTip title={title} label={t("about", { title })} {...content} />;
}
