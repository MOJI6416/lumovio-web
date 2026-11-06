import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { redirectSignedIn } from "@/components/auth/redirect-signed-in";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await redirectSignedIn(searchParams);
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
