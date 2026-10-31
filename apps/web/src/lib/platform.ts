"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** The platform's state for this visitor (Admin → Management): announcements, registration, maintenance, the Score. */
export interface PlatformState {
  registration: "open" | "closed";
  maintenance: { on: boolean; message: string | null };
  announcements: { id: string; text: string; tone: "info" | "warning" }[];
  score: boolean;
}

export const usePlatform = () => useQuery({ queryKey: ["platform"], queryFn: () => api<PlatformState>("/api/platform"), staleTime: 60_000, retry: false });
