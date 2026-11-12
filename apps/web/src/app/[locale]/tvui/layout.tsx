import type { ReactNode } from "react";
import { TvApp } from "@/components/tvui/shell/TvApp";

/** The TV shell: every address of a device in TV mode is answered here (proxy.ts). */
export default function TvLayout({ children }: { children: ReactNode }) {
  return <TvApp>{children}</TvApp>;
}
