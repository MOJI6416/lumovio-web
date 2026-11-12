"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PortalContainerContext } from "@/components/ui/portal";
import { ControlsActions } from "./ControlsActions";
import { ControlsChips } from "./ControlsChips";
import { ControlsFields } from "./ControlsFields";
import { ControlsNavigation } from "./ControlsNavigation";
import { ControlsToggles } from "./ControlsToggles";

const SECTIONS = [
  ["button", "button"],
  ["icon-button", "iconButton"],
  ["link", "link"],
  ["chips", "chips"],
  ["badges", "badges"],
  ["tabs", "tabs"],
  ["segmented", "segmented"],
  ["fields", "fields"],
  ["select", "select"],
  ["toggles", "toggles"],
  ["slider", "slider"],
] as const;

/**
 * The control primitives in the showcase. Lists and popovers open in a layer that
 * carries the showcase's theme, so they follow its theme switch rather than the site's. The layer sits outside the
 * showcase's TV zoom (zoom would misplace them); real TV mode scales them with the root size.
 */
export function ControlsSections() {
  const t = useTranslations("devUi");
  const anchor = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  // The showcase remounts this on every theme switch, so reading it once is enough.
  useEffect(() => setTheme(anchor.current?.closest("[data-theme]")?.getAttribute("data-theme") ?? "dark"), []);
  return (
    <PortalContainerContext.Provider value={layer}>
      {theme && createPortal(<div ref={setLayer} data-theme={theme} />, document.body)}
      <nav ref={anchor} aria-label={t("controls")} className="border-t border-line py-6">
        <h2 className="mb-2 text-h3">{t("controls")}</h2>
        <ul className="flex flex-wrap gap-x-4">
          {SECTIONS.map(([id, key]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex min-h-11 min-w-11 items-center text-body-s font-semibold text-text-2 hover:text-text-1 md:min-h-8 md:min-w-0"
              >
                {t(key)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ControlsActions />
      <ControlsChips />
      <ControlsNavigation />
      <ControlsFields />
      <ControlsToggles />
    </PortalContainerContext.Provider>
  );
}
