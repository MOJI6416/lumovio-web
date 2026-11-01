import type { useTranslations } from "next-intl";
import { isPrivateHost, MediaNetError, type NetErrorCode } from "@/lib/media/net";

/**
 * A failure talking to the person's own server, in their words; never the error's own (English) text (X-15, SRV-02).
 * `url`: the server's address, when known — an http:// address of the home network that this browser still refused
 * is said apart from a public one (Chrome and Edge reach it after the local network permission; others don't).
 */
export function netErrorText(t: ReturnType<typeof useTranslations>, e: unknown, url?: string): string {
  if (e instanceof MediaNetError) {
    return {
      mixed_content: url && isPrivateHost(url) ? t("errMixedContentLan") : t("errMixedContent"),
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
  return t("errGeneric");
}

/** A failed check as the server's row keeps it (`statusDetail`): the failure's kind, never its text. */
export function failureDetail(e: unknown): string | null {
  return e instanceof MediaNetError ? `net:${e.code}` : null;
}

const CODES: NetErrorCode[] = ["mixed_content", "cors", "timeout", "auth", "local_network", "tls", "http", "unreachable", "not_found"];

/** The kind of failure a check stored (`failureDetail`), or null for anything else (a version, an older check). */
export function storedFailure(detail: string | null): NetErrorCode | null {
  const code = detail?.startsWith("net:") ? (detail.slice(4) as NetErrorCode) : null;
  return code && CODES.includes(code) ? code : null;
}
