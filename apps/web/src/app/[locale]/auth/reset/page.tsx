import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/ResetForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle"), robots: { index: false } };
}

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
