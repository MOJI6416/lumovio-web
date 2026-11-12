"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Link } from "@/components/ui/Link";

/**
 * "Why this?" from a personal card's "More": every fact the pick's reason holds — the profile's
 * title it comes from and how the profile showed it likes it, people, genres, ratings, a copy on its servers — and the
 * way to adjust recommendations. Only facts the API confirms (components/media/recommendation-copy.ts whyLines).
 */
export function WhyDialog({ open, onOpenChange, title, lines }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; lines: string[] }) {
  const t = useTranslations("rows");
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title={t("whyTitle", { title })}>
      <ul className="list-disc space-y-2 ps-5 text-body text-text-1">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-4 text-body-s text-text-2">{t("whyPrivacy")}</p>
      <DialogActions className="md:items-center md:justify-between">
        <Link variant="action" arrow href="/settings/recommendations">
          {t("whySettings")}
        </Link>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {tc("close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
