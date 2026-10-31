"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/** "Back" to the page the person came from — only when there is one in this tab's history (an opened link has none). */
export function BackButton() {
  const tc = useTranslations("common");
  const [can, setCan] = useState(false);
  useEffect(() => setCan(window.history.length > 1), []);
  if (!can) return null;
  return (
    <Button variant="tertiary" icon={ArrowLeft} onClick={() => window.history.back()}>
      {tc("back")}
    </Button>
  );
}
