"use client";

import type { ReactNode } from "react";
import { showsAnime } from "@/lib/show-anime";
import { useSession } from "../providers/Providers";

/** Its children only while the active profile is offered anime (design-system 8.14), for frames that render on the server too. */
export function AnimeOnly({ children }: { children: ReactNode }) {
  return showsAnime(useSession().me) ? children : null;
}
