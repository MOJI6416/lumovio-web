import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** A showcase section: heading, where the component lives, and the examples. */
export function ShowcaseSection({
  id,
  title,
  source,
  children,
}: {
  id: string;
  title: string;
  /** Where the component lives: its source files (and helpers), joined by " · " or commas. */
  source: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-line py-10">
      <h2 id={`${id}-title`} className="text-h2">
        {title}
      </h2>
      <p className="mt-1 mb-6 text-body-s text-text-2">{source}</p>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}

/** One group of examples with a short heading (a component name or a state). */
export function Demo({ title, note, className, children }: { title: string; note?: string; className?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h3">{title}</h3>
      {note && <p className="max-w-measure text-body-s text-text-2">{note}</p>}
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}

/** A labelled cell in a grid of states. */
export function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <span className="text-caption text-text-3">{label}</span>
      {children}
    </div>
  );
}

/**
 * Artwork with the start scrim, the way heroes and the player show controls. `stage` marks it as a stage;
 * without it the block is plain art as on today's site, where the old on-art button names draw the stage values
 * themselves.
 */
export function Art({ stage = true, className, children }: { stage?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-sm bg-stage", stage && "stage", className)}>
      {/* biome-ignore lint/performance/noImgElement: a static brand image stands in for artwork */}
      <img src="/brand/og.png" alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0" style={{ backgroundImage: "var(--scrim-start)" }} />
      <div className="relative flex flex-wrap items-center gap-3 p-6">{children}</div>
    </div>
  );
}
