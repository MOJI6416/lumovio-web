"use client";

import { useTranslations } from "next-intl";
import { ExpandableText } from "@/components/title/ExpandableText";

/**
 * A biography: three lines under the name, then "More" in place, as a title's overview; 72 characters wide.
 */
export function Bio({ text }: { text: string }) {
  const t = useTranslations("personPage");
  return <ExpandableText text={text} lines={3} label={t("readBio")} className="text-body-l text-text-1" />;
}
