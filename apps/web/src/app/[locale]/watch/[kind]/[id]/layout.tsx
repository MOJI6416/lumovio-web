import type { ReactNode } from "react";
import { BootBoundary } from "@/components/shell/BootBoundary";

/** Opened by its address, the player's page shows the intro on the stage while its title loads (design-system 6.3.1). */
export default function WatchLayout({ children }: { children: ReactNode }) {
  return <BootBoundary stage>{children}</BootBoundary>;
}
