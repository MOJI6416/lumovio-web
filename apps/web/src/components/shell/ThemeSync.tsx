"use client";

import { useEffect } from "react";
import { followSystemTheme } from "@/lib/prefs";

/**
 * Mounted once in the root layout: "As the system" follows the OS while the page is open. A module of its own,
 * so the layout doesn't carry the theme and language controls (shell/Preferences) into every route (bundle budget).
 */
export function ThemeSync() {
  useEffect(() => followSystemTheme(), []);
  return null;
}
