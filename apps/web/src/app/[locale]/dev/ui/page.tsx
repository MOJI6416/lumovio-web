import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { TokenShowcase } from "@/components/dev/TokenShowcase";
import { getMe } from "@/lib/server-api";
import { isTvUserAgent } from "@/lib/tv";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("devUi");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The design-system showcase: every token and every components/ui primitive.
 * Open to anyone on a development server; a production build shows it to admins only and answers
 * everyone else with a plain 404, so its existence isn't advertised. Not linked from any navigation.
 */
async function isAdmin() {
  try {
    return (await getMe())?.user.role === "admin";
  } catch {
    return false;
  }
}

export default async function DevUiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (process.env.NODE_ENV === "production" && !(await isAdmin())) notFound();
  // Starts from the site's own theme and TV mode (decided like the locale layout does); the showcase's switches
  // then change only the showcase.
  const [c, h, messages] = await Promise.all([cookies(), headers(), getMessages()]);
  const tvCookie = c.get("lumovio_tv")?.value;
  // The layout leaves the showcase's own messages (devUi) out of every other page; this page adds them back.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TokenShowcase
        initialTheme={c.get("lumovio_theme")?.value === "light" ? "light" : "dark"}
        siteTv={tvCookie ? tvCookie === "1" : isTvUserAgent(h.get("user-agent"))}
      />
    </NextIntlClientProvider>
  );
}
