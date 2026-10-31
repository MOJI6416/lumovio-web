"use client";

import { useTranslations } from "next-intl";
import { apiErrorKey } from "@/lib/api-errors";
import { MediaNetError } from "@/lib/media/net";

/*
 * What went wrong talking to the person's media server or to Lumovio, in words (design-system 2.1, 8.5; L10N-04) —
 * the same texts as connections/net-errors, in a module the player and the sources screen take without the
 * connections screen (X-43).
 */

/** A media server's own reason (CORS, certificate, timeout…) in the `connections` namespace's words. */
export function netReason(t: ReturnType<typeof useTranslations>, e: MediaNetError): string {
  return {
    mixed_content: t("errMixedContent"),
    cors: t("errCors"),
    timeout: t("errTimeout"),
    auth: t("errAuth"),
    local_network: t("errLocalNetwork"),
    tls: t("errTls"),
    unreachable: t("errTimeout"),
    not_found: t("errNotFound"),
    http: t("errHttp", { status: e.status ?? 0 }),
  }[e.code];
}

/** The media server's reason, its HTTP status, or the API error's key — never an error's own (English) text. */
export function useMediaErrorText() {
  const t = useTranslations();
  const tn = useTranslations("connections");
  const tp = useTranslations("player");
  return (e: unknown): string => {
    if (e instanceof MediaNetError) {
      if (e.code !== "http") return netReason(tn, e);
      return e.status ? tp("errorHttp", { status: e.status }) : t("errors.generic");
    }
    return t(apiErrorKey(e));
  };
}

/** "1–3, 5": episode numbers as ranges. */
export function ranges(nums: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++;
    out.push(j > i ? `${nums[i]}–${nums[j]}` : `${nums[i]}`);
    i = j;
  }
  return out.join(", ");
}
