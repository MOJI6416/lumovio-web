"use client";

import dynamic from "next/dynamic";
import { useSession } from "@/components/providers/Providers";

// Loaded only for a signed-in profile: a guest's person page doesn't carry it (bundle budget).
const PersonMute = dynamic(() => import("./PersonMute").then((m) => m.PersonMute), { ssr: false });

/** "Don't show in recommendations" on a person's page, for a signed-in profile only (PersonMute). */
export function PersonMuteSlot(props: { id: number; name: string }) {
  const { me } = useSession();
  return me?.activeProfile ? <PersonMute {...props} /> : null;
}
