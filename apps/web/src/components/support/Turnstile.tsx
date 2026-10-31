"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

/** Cloudflare's script, once per page. */
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.append(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile for a guest's form (support, sign-in, sign-up, the password reset): the check in the page's
 * language; `onToken` gets the token, or null when it expires or fails. `theme` "dark" on the always-dark sign-in
 * pages. Only where the API has Turnstile configured (`turnstileSiteKey`).
 */
export function Turnstile({ siteKey, onToken, theme = "auto" }: { siteKey: string; onToken: (token: string | null) => void; theme?: "auto" | "dark" }) {
  const box = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  useEffect(() => {
    let id: string | undefined;
    let gone = false;
    load()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          language: locale,
          theme,
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      gone = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, locale, onToken, theme]);
  return <div ref={box} className="min-h-16" />;
}
