import type { useTranslations } from "next-intl";
import { ApiRequestError } from "@/lib/api";

type Translate = ReturnType<typeof useTranslations<"profiles">>;

/** Profile API errors in the person's language (PRF-06, PRF-07): never the API's own English message. */
export function profileErrorText(t: Translate, e: unknown, context: "pin" | "password" | "code" | "save" | "delete"): string {
  if (!(e instanceof ApiRequestError)) return t("errGeneric");
  switch (e.code) {
    case "pin_required":
      return t("wrongPin");
    case "password_required":
      // A mailed code that is wrong, used or expired is refused like a wrong password.
      return context === "code" ? t("wrongCode") : t("wrongPassword");
    case "rate_limited":
      return t("tooManyAttempts");
    case "bad_request":
      return context === "pin" ? t("pinFormat") : context === "password" ? t("wrongPassword") : context === "code" ? t("wrongCode") : t("errInvalid");
    case "conflict":
      return context === "delete" ? t("lastProfile") : t("limit");
    case "not_found":
      return t("errNotFound");
    case "kids_restricted":
      return t("kidsRestrictedText");
    case "network":
      return t("errNetwork");
    default:
      return t("errGeneric");
  }
}

/** Why the code to leave the kids profile wasn't mailed: too many, offline, or the mail didn't go (said in the dialog). */
export function codeSendErrorText(t: Translate, e: unknown): string {
  if (e instanceof ApiRequestError && e.code === "rate_limited") return t("tooManyAttempts");
  if (e instanceof ApiRequestError && e.code === "network") return t("errNetwork");
  return t("codeSendFailed");
}

/** Whether a refusal is about the PIN typed (said at the PIN field) rather than the whole form. */
export const isPinError = (e: unknown) => e instanceof ApiRequestError && (e.code === "pin_required" || e.code === "rate_limited");
