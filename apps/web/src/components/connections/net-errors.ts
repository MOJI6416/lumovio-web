import type { useTranslations } from "next-intl";
import { MediaNetError } from "@/lib/media/net";

/** A failure talking to the person's own server, in their words; never the error's own (English) text (X-15, SRV-02). */
export function netErrorText(t: ReturnType<typeof useTranslations>, e: unknown): string {
  if (e instanceof MediaNetError) {
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
  return t("errGeneric");
}
