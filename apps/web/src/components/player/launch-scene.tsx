"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";
import { BrandLoader } from "@/components/ui/BrandMotion";
import { IconButton } from "@/components/ui/IconButton";
import type { LaunchScene } from "./launch";

/**
 * What the launch's scene says (./launch, design-system 11.1 «Запуск») over its black: "←" from the start, the loader
 * and what is being done now after --loader-delay, the ways out when it takes a while.
 */
export default function LaunchSceneContent({ scene, since }: { scene: LaunchScene; since: number }) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const { status, detail, actions, onBack, backLabel } = scene;
  return (
    <>
      {onBack && (
        <div className="absolute start-4 top-[max(1rem,env(safe-area-inset-top))] md:start-8 md:top-8">
          <IconButton icon={ArrowLeft} label={backLabel ?? tc("back")} variant="stage" size="lg" onClick={onBack} className="[&_svg]:rtl:-scale-x-100" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 grid place-items-center px-4">
        <Later at={300} since={since} role="status" aria-live="polite" className="flex max-w-120 flex-col items-center gap-3 text-center">
          <BrandLoader size="lg" />
          <p className="text-body font-semibold text-text-1">{status ?? t("loading")}</p>
          {detail && <p className="break-words text-body-s text-text-2 tabular-nums">{detail}</p>}
        </Later>
      </div>
      {actions && (
        <Later at={4000} since={since} className="absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] flex flex-wrap justify-center gap-3 px-4 md:bottom-12">
          {actions}
        </Later>
      )}
    </>
  );
}

/**
 * A part of the scene that appears `at` ms into the launch — the loader and words after --loader-delay, the ways out
 * after 4 s — counted from the launch's start whenever the part mounts, and fixed then (a re-render doesn't move it).
 */
function Later({ at, since, className, ...rest }: { at: number; since: number } & ComponentProps<"div">) {
  const [delay] = useState(() => Math.max(0, at - (performance.now() - since)));
  return <div {...rest} className={`loader-appear ${className}`} style={{ animationDelay: `${Math.round(delay)}ms` }} />;
}
