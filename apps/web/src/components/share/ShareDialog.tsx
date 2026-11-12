"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { qrImage } from "@/lib/qr";
import { useAction } from "@/lib/use-action";
import { type ShareRequest, shareStore } from "./share";

/**
 * Where a link can go from the share window: each service's own share address, opened in a new tab (nothing loads from
 * the service before the click). The marks are the services' own (Simple Icons, CC0; trademarks of their owners,
 * credited on the Credits page), drawn on a white disc in both themes.
 */
const SERVICES: { name: string; mark: string; href: (r: ShareRequest) => string }[] = [
  { name: "Telegram", mark: "/brands/telegram.svg", href: (r) => `https://t.me/share/url?url=${enc(r.url)}&text=${enc(r.title)}` },
  { name: "WhatsApp", mark: "/brands/whatsapp.svg", href: (r) => `https://wa.me/?text=${enc(`${r.title} ${r.url}`)}` },
  { name: "X", mark: "/brands/x.svg", href: (r) => `https://x.com/intent/post?url=${enc(r.url)}&text=${enc(r.title)}` },
  { name: "Facebook", mark: "/brands/facebook.svg", href: (r) => `https://www.facebook.com/sharer/sharer.php?u=${enc(r.url)}` },
  { name: "Reddit", mark: "/brands/reddit.svg", href: (r) => `https://www.reddit.com/submit?url=${enc(r.url)}&title=${enc(r.title)}` },
];
const enc = encodeURIComponent;

const tile = "flex flex-col items-center gap-2 rounded-md p-2 text-caption text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1";
const disc = "grid size-12 place-items-center rounded-full bg-white ring-1 ring-line";

/** The open share request as a dialog; <Providers /> mounts it only while one is open. */
export function ShareHost() {
  const request = useSyncExternalStore(shareStore.subscribe, shareStore.get, () => null);
  if (!request) return null;
  return <ShareDialog key={request.url} request={request} />;
}

function ShareDialog({ request }: { request: ShareRequest }) {
  const t = useTranslations();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void qrImage(request.url, 240).then((src) => live && setQr(src));
    return () => {
      live = false;
    };
  }, [request.url]);
  const copy = useAction({ run: () => navigator.clipboard.writeText(request.url), success: t("title.shareCopied") });

  return (
    <Dialog open onOpenChange={(open) => !open && shareStore.close()} title={t("common.share")} description={request.title}>
      <div className="flex flex-col gap-6">
        <div className="flex gap-2">
          <Input
            readOnly
            value={request.url}
            aria-label={t("share.link")}
            className="min-w-0 flex-1"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="secondary" loading={copy.pending} onClick={() => void copy.run()}>
            {t("common.copy")}
          </Button>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SERVICES.map((s) => (
            <li key={s.name}>
              <a href={s.href(request)} target="_blank" rel="noopener noreferrer" className={tile}>
                <span className={disc}>
                  {/* biome-ignore lint/performance/noImgElement: a small static brand mark, no image optimisation to gain */}
                  <img src={s.mark} alt="" aria-hidden draggable={false} className="size-7 select-none" />
                </span>
                {s.name}
              </a>
            </li>
          ))}
          <li>
            <a href={`mailto:?subject=${enc(request.title)}&body=${enc(request.url)}`} className={tile}>
              {/* Not a brand: a neutral disc. */}
              <span className="grid size-12 place-items-center rounded-full bg-surface-3 text-text-1">
                <Mail aria-hidden className="size-6" />
              </span>
              {t("share.email")}
            </a>
          </li>
        </ul>
        <div className="flex items-center gap-4 rounded-md bg-surface-2 p-3">
          <div className="size-28 shrink-0 rounded-sm bg-white p-1">
            {/* biome-ignore lint/performance/noImgElement: a generated data: URL */}
            {qr && <img src={qr} alt={t("share.qrAlt")} width={104} height={104} className="size-full" />}
          </div>
          <p className="text-body-s text-text-2">{t("share.qrHint")}</p>
        </div>
      </div>
    </Dialog>
  );
}
