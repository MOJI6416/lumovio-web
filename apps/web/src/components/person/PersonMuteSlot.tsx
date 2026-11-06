"use client";

import dynamic from "next/dynamic";
import { useSession } from "@/components/providers/Providers";

// Loaded only for a signed-in profile: a guest's person page doesn't carry it (bundle budget).
const PersonMute = dynamic(() => import("./PersonMute").then((m) => m.PersonMute), { ssr: false });

/**
 * "Don't show in recommendations" under the biography, for a signed-in profile only (PersonMute); its line is held
 * while the module and the profile's list load, so the page under it doesn't move.
 */
export function PersonMuteSlot(props: { id: number; name: string }) {
  const { me } = useSession();
  return me?.activeProfile ? (
    <div className="mt-2 flex min-h-11 items-center sm:min-h-8">
      <PersonMute {...props} />
    </div>
  ) : null;
}
