"use client";

import { useTranslations } from "next-intl";
import { ExpandableText } from "@/components/title/ExpandableText";

/** A biography (PER-02): six lines, then "More" in place; the reading width of 72 characters. */
export function Bio({ text }: { text: string }) {
  const t = useTranslations("personPage");
  return <ExpandableText text={text} lines={6} label={t("readBio")} className="text-body-l text-text-1" />;
}
