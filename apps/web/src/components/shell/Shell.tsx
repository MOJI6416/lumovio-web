import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { NavigationLoading } from "./NavigationLoading";
import { ShellHeader } from "./ShellHeader";

/**
 * The frame of every product page: header, main, footer and the phone's bottom bar. On a phone the
 * page ends above the bar and the home indicator's safe area. Works in server and client components, so the
 * 404 and the error page (outside the (main) layout) have the same frame. `overlay`: the page opens on a stage. While a
 * tapped link's page is prepared, its place shows the loader (NavigationLoading).
 */
export function Shell({ children, overlay, top }: { children: ReactNode; overlay?: boolean; top?: ReactNode }) {
  return (
    <div className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {/* Above the header (announcements): a page's art slides under the header, never over this. */}
      {top}
      <ShellHeader overlay={overlay} />
      <main id="main" className="min-h-[60vh]">
        {children}
        <NavigationLoading />
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
