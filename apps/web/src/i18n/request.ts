import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import en from "../../messages/en.json";
import { withEnglish } from "./messages";
import { routing } from "./routing";

type Messages = typeof en;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  let messages: Messages = en;
  if (locale !== "en") {
    try {
      // apps/web/messages/<locale>.json: a draft language may have none yet, or only part of the keys.
      const own = (await import(`../../messages/${locale}.json`)).default as Partial<Messages>;
      messages = withEnglish(en, own);
    } catch {
      messages = en;
    }
  }
  return { locale, messages, timeZone: "UTC" };
});
