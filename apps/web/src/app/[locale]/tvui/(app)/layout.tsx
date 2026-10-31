import type { ReactNode } from "react";
import { BootBoundary } from "@/components/shell/BootBoundary";
import { NavigationLoading } from "@/components/shell/NavigationLoading";
import { NavRail } from "@/components/tvui/shell/NavRail";
import { TvEvents } from "@/components/tvui/shell/TvEvents";
import { TvUnavailable } from "@/components/tvui/shell/TvUnavailable";
import { requireTvProfile } from "@/lib/tv-server";

/**
 * The TV shell's screens with the menu: a signed-in profile only (a guest gets the code screen). The first screen streams
 * behind the app's launch mark; a later one shows the loader beside the menu while it is prepared (design-system 6.3.1).
 */
export default async function TvMenuLayout({ children }: { children: ReactNode }) {
  const me = await requireTvProfile();
  if (me === "unavailable") return <TvUnavailable />;
  return (
    <>
      <NavRail />
      <TvEvents />
      <main data-tv-main className="h-full ps-(--tv-rail)">
        <BootBoundary tv>{children}</BootBoundary>
        <NavigationLoading tv />
      </main>
    </>
  );
}
