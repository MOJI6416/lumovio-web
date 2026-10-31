"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { wantsGrid } from "@/lib/discover";
import { Header } from "./Header";

/** Pages that open on artwork: the home billboard, a title's hero, a catalog section's billboard (not its grid). */
const ART = [/^\/$/, /^\/title\//];
const SECTION = /^\/(?:browse\/(?:movie|tv)|anime)$/;

export function ShellHeader({ overlay }: { overlay?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    // "/" opens search from anywhere (except while typing).
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [router]);
  // The first paint's guess; the header then checks the page itself (Header).
  const art = overlay ?? (ART.some((r) => r.test(pathname)) || (SECTION.test(pathname) && !wantsGrid((k) => params.get(k))));
  return <Header key={pathname} overlay={art} />;
}
