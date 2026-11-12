"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PortalContainerContext } from "@/components/ui/portal";
import { LayersDialogs } from "./LayersDialogs";
import { LayersFeedback } from "./LayersFeedback";
import { LayersOverlays } from "./LayersOverlays";
import { LayersPage } from "./LayersPage";
import { LayersStates } from "./LayersStates";

const SECTIONS = [
  ["menu", "menu"],
  ["popover", "popover"],
  ["tooltip", "tooltip"],
  ["dialog", "dialogs"],
  ["confirm", "confirm"],
  ["toast", "toasts"],
  ["inline-alert", "inlineAlert"],
  ["skeleton", "skeleton"],
  ["brand-motion", "brandMotion"],
  ["progress", "progressSteps"],
  ["empty-state", "emptyState"],
  ["error-state", "errorState"],
  ["query-state", "queryState"],
  ["spoiler", "spoiler"],
  ["page-header", "pageHeader"],
  ["settings", "settingsParts"],
  ["use-action", "useAction"],
] as const;

/**
 * The layers, states and behaviour in the showcase. Menus, dialogs and confirmations
 * open inside the showcase, so they take its theme; live toasts use the site's one queue (and theme), their look in
 * both themes is drawn statically.
 */
export function LayersSections() {
  const t = useTranslations("devUi");
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  return (
    <PortalContainerContext.Provider value={layer}>
      <nav aria-label={t("layersNav")} className="border-t border-line py-6">
        <h2 className="mb-2 text-h3">{t("layersNav")}</h2>
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
      <LayersOverlays />
      <LayersDialogs />
      <LayersFeedback />
      <LayersStates />
      <LayersPage />
      <div ref={setLayer} />
    </PortalContainerContext.Provider>
  );
}
