"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { sharePage } from "@/components/share/share";

/** "Share" of a public profile (8.15): the system's sheet on a phone, Lumovio's window with the link and a QR on a computer. */
export function ShareProfile({ title, url }: { title: string; url: string }) {
  const t = useTranslations("common");
  return (
    <Button variant="secondary" icon={Share2} onClick={() => void sharePage({ title, url: new URL(url, window.location.origin).href })}>
      {t("share")}
    </Button>
  );
}
