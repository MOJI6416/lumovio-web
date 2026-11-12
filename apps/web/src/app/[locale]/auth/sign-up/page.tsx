import type { AuthCapabilities } from "@lumovio/contracts";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { configuredProviders } from "@/components/auth/providers";
import { redirectSignedIn } from "@/components/auth/redirect-signed-in";
import { optional } from "@/lib/optional";
import type { PlatformState } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: t("signUpTitle"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await redirectSignedIn(searchParams);
  // The social buttons are drawn with the page — only the configured ones, or none; registration closed by
  // an admin is known before anything is drawn, so the form never shows and then flips to "closed".
  const [caps, platform] = await Promise.all([
    optional(serverApi<AuthCapabilities>("/api/auth-capabilities"), null),
    optional(serverApi<PlatformState>("/api/platform"), null),
  ]);
  return (
    <Suspense>
      <SignUpForm providers={configuredProviders(caps)} closed={platform?.registration === "closed"} />
    </Suspense>
  );
}
