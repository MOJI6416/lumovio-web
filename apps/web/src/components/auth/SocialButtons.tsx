"use client";

import type { AuthCapabilities } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { authErrorKey } from "@/lib/api-errors";
import { authClient } from "@/lib/auth-client";
import { authCall } from "./auth-call";
import { configuredProviders, type SocialProvider } from "./providers";

export type { SocialProvider };

// Third-party marks keep their own colours (design-system 3.6).
const GOOGLE = "#EA4335"; // ui-lint-ignore hex-color: Google brand mark (3.6)
const DISCORD = "#5865F2"; // ui-lint-ignore hex-color: Discord brand mark (3.6)

const PROVIDERS = [
  {
    id: "google",
    name: "Google",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="size-5">
        <path fill={GOOGLE} d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
    ),
  },
  {
    id: "apple",
    name: "Apple",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-current">
        <path d="M16.4 12.6c0-2.5 2.1-3.7 2.2-3.8-1.2-1.7-3-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1zM13.9 5.1c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
      </svg>
    ),
  },
  {
    id: "discord",
    name: "Discord",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill={DISCORD}>
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.9-9.7-3.6-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
      </svg>
    ),
  },
] as const;

/**
 * OAuth buttons and the "or" under them — only for the providers the server has credentials for (AUTH-10): nothing at
 * all, and no hanging divider, when none is set up. The page passes `providers` (no jump when they appear); without
 * it they are asked here. `next` is where the provider brings the person back: Who's watching, then their page.
 */
export function SocialButtons({ next, providers }: { next: string; providers?: SocialProvider[] | null }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tr = useTranslations();
  const caps = useQuery({
    queryKey: ["auth-caps"],
    queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"),
    staleTime: Infinity,
    enabled: !providers,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const ids = providers ?? configuredProviders(caps.data ?? null) ?? [];
  const configured = PROVIDERS.filter((p) => ids.includes(p.id));
  if (configured.length === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-2">
        {configured.map((p) => (
          <Button
            key={p.id}
            variant="secondary"
            size="lg"
            className="w-full"
            loading={busy === p.id}
            onClick={async () => {
              setBusy(p.id);
              const res = await authCall(() => authClient.signIn.social({ provider: p.id, callbackURL: next }));
              if (res.error) {
                toast.error(tr(authErrorKey(res.error)));
                setBusy(null);
              }
            }}
          >
            {p.icon}
            {t("continueWith", { provider: p.name })}
          </Button>
        ))}
      </div>
      <div className="my-6 flex items-center gap-3 text-caption text-text-3">
        <span className="h-px flex-1 bg-line" />
        {tc("or")}
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
