import type { AuthCapabilities } from "@lumovio/contracts";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/AuthForms";
import { configuredProviders } from "@/components/auth/providers";
import { redirectSignedIn } from "@/components/auth/redirect-signed-in";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: t("signUpTitle"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await redirectSignedIn(searchParams);
  // The social buttons are drawn with the page — only the configured ones, or none (AUTH-10).
  const providers = configuredProviders(await optional(serverApi<AuthCapabilities>("/api/auth-capabilities"), null));
  return (
    <Suspense>
      <SignUpForm providers={providers} />
    </Suspense>
  );
}
