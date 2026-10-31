import { cn } from "./cn";

export type SkeletonShape = "xs" | "sm" | "md" | "full";

const RADIUS: Record<SkeletonShape, string> = {
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
  full: "rounded-full",
};

/**
 * A placeholder of what is loading (design-system 7.11): it repeats the final layout — the same card and row sizes,
 * given with `className` — so nothing jumps when the content arrives. Shimmers every 1.6 s (`.skeleton`,
 * globals.css); with reduced motion it stays still. Hidden from screen readers: the region around it says
 * "Loading…" (QueryState does).
 */
export function Skeleton({ shape = "sm", className }: { shape?: SkeletonShape; className?: string }) {
  return <span aria-hidden className={cn("skeleton block", RADIUS[shape], className)} />;
}

/** Lines of text: body height, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder lines
          key={i}
          className={cn("skeleton block h-4 rounded-xs", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </span>
  );
}
