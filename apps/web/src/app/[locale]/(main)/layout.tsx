import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { AnnouncementsSlot } from "@/components/shell/AnnouncementsSlot";
import { BootBoundary } from "@/components/shell/BootBoundary";
import { Shell } from "@/components/shell/Shell";
import { redirect } from "@/i18n/navigation";
import { getMeState } from "@/lib/server-api";

export default async function MainLayout({ children }: { children: ReactNode }) {
  // An API that doesn't answer leaves the page to say so itself (ServiceUnavailable); a guest has no profile.
  const me = await getMeState();
  // Signed in but no profile chosen on this device yet → "Who's watching?".
  if (me && me !== "unavailable" && !me.activeProfile) redirect({ href: "/profiles", locale: await getLocale() });
  return (
    <Shell top={<AnnouncementsSlot />}>
      <BootBoundary>{children}</BootBoundary>
    </Shell>
  );
}
