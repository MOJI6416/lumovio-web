import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { TwoFactorForm } from "@/components/auth/AuthForms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("twoFactorTitle"), robots: { index: false } };
}

export default async function Page() {
  // The cookie of a sign-in waiting for its code (Better Auth's "two_factor", with Lumovio's prefix): without it the
  // page says to sign in again instead of showing a form that can only fail (AUTH-08).
  const started = (await cookies()).getAll().some((c) => c.name.endsWith("lumovio.two_factor"));
  return (
    <Suspense>
      <TwoFactorForm started={started} />
    </Suspense>
  );
}
