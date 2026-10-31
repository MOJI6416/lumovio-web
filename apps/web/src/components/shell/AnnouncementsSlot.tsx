"use client";

import dynamic from "next/dynamic";

/** The announcements load apart from the page's own code: they're rare, and the page shouldn't pay for them. */
export const AnnouncementsSlot = dynamic(() => import("./Announcements").then((m) => m.Announcements), { ssr: false });
