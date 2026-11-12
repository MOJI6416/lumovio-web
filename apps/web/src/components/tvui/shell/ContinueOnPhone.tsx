"use client";

import { Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { localizedPath } from "@/lib/seo";
import { qrImage } from "@/lib/qr";

/**
 * "Continue on your phone": what is set up on a phone or a computer
 * — servers, sign-in methods, import, the account — is offered from the TV as a QR code and a short address that open
 * that very page there. Scanning gives no access by itself: the phone signs in to its own account.
 */
export function ContinueOnPhone({ path, url: absolute, title, text }: { path?: string; url?: string; title: string; text?: string }) {
  const t = useTranslations("tvui");
  const locale = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    // The site's own address, as this TV opened it (lumovio.app, or a local dev server it is tested on).
    const full = absolute ?? `${window.location.origin}${localizedPath(locale, path ?? "/")}`;
    setUrl(full);
    void qrImage(full, 360).then(setQr, () => setQr(null));
  }, [locale, path, absolute]);
  const short = (url ?? "").replace(/^https?:\/\//, "");
  return (
    <div className="flex items-center gap-12">
      <div className="shrink-0 rounded-md bg-white p-4">
        {qr ? (
          <img src={qr} alt={t("phoneQr")} className="size-60" />
        ) : (
          <div aria-hidden className="size-60" />
        )}
      </div>
      <div className="flex max-w-150 flex-col gap-4">
        <Smartphone aria-hidden className="size-12 text-text-3" />
        <h2 className="text-h2 text-text-1">{title}</h2>
        <p className="text-body-l text-text-2">{text ?? t("phoneText")}</p>
        <p className="text-body-l font-semibold break-all text-text-1">{short}</p>
      </div>
    </div>
  );
}
