import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlayerCheck } from "@/components/dev/PlayerCheck";
import { getMe } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("playerCheck");
  return { title: t("title"), robots: { index: false, follow: false } };
}

async function isAdmin() {
  try {
    return (await getMe())?.user.role === "admin";
  } catch {
    return false;
  }
}

/**
 * The device check (S42; docs/player-compatibility-and-ux-2026-10-23.md P5): which formats this browser plays in
 * Lumovio's player. Like /dev/ui, open to anyone on a development server; a production build shows it to admins only
 * and answers everyone else with a plain 404. Not linked from any navigation.
 */
export default async function PlayerCheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (process.env.NODE_ENV === "production" && !(await isAdmin())) notFound();
  return <PlayerCheck />;
}
