"use client";

import type { AuthCapabilities } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Turnstile } from "@/components/support/Turnstile";
import { api } from "@/lib/api";

/**
 * Cloudflare Turnstile on sign-in, sign-up and the password reset: with keys on the API, Better Auth's captcha plugin
 * wants `x-captcha-response` on those three (auth.ts). The widget goes above the form's button and the token with the
 * request; a token serves one attempt, so every attempt starts a new check. Without keys nothing shows and nothing is
 * sent (operations.md, "Support").
 */
export function useAuthCaptcha() {
  const caps = useQuery({ queryKey: ["auth-caps"], queryFn: () => api<AuthCapabilities>("/api/auth-capabilities"), staleTime: Infinity });
  const siteKey = caps.data?.turnstileSiteKey ?? null;
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  return {
    /** Turnstile is on and its check hasn't passed (yet). */
    missing: siteKey !== null && !token,
    /** The token's header for the request, when Turnstile is on. */
    headers: (): Record<string, string> => (siteKey && token ? { "x-captcha-response": token } : {}),
    /** After an attempt: the token is used up, a new check starts. */
    spent: () => {
      if (!siteKey) return;
      setToken(null);
      setRound((n) => n + 1);
    },
    widget: siteKey ? <Turnstile key={round} siteKey={siteKey} onToken={setToken} theme="dark" /> : null,
  };
}
