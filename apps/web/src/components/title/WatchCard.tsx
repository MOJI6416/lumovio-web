import { ChevronDown } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { ServerMark } from "@/components/connections/ServerMark";
import { FilterChip } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * "Where to watch" in one card: what will be watched — what is heard as the heading,
 * the picture as marks with what they don't say, where it comes from — then the white "Watch" with its "i" or "More"
 * under it, as the hero has them, and under a line the choices that lead to another one. The same card says every
 * state of the way: a search running or failed, nothing found, a server out of reach, the guest's sign-in, a profile
 * without servers — one place and one look for the moment someone wants to start watching.
 */
export function WatchCard({
  id,
  mark,
  tag,
  heading,
  quality,
  where,
  note,
  actions,
  children,
  className,
}: {
  /** The heading's id: the card is a region named by it. */
  id: string;
  /** The source's type (ServerMark), or several (ServerMarks). */
  mark: ReactNode;
  /** A Tag above the heading: what it has to do with the profile ("Your dubbing · Le Doyen"). */
  tag?: ReactNode;
  heading: ReactNode;
  /** The picture and sound: QualityLine / ReleaseLine, at body size so the marks are large. */
  quality?: ReactNode;
  /** Where it comes from and how much: "Through TorrServer «torr» · 270 seeders · RuTracker". */
  where?: ReactNode;
  /** One line that needs saying (a format this device may not play): with its own icon. */
  note?: ReactNode;
  /** "Watch" and its "i" / "More", or the state's one action. */
  actions?: ReactNode;
  /** Under a line: the pickers and a quiet link, or an alert. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("rounded-lg bg-surface-1 p-4 sm:p-6", className)}>
      <div className="flex items-start gap-4">
        {mark}
        <div className="min-w-0 flex-1 sm:pt-0.5">
          {tag && <div className="mb-1.5 flex flex-wrap gap-1.5">{tag}</div>}
          {/* Under the page's "Where to watch" (h2). */}
          <h3 id={id} className="text-h3 break-words text-text-1">
            {heading}
          </h3>
          {quality && <p className="mt-1.5 text-body-l break-words text-text-1">{quality}</p>}
          {where && <p className="mt-1 text-body-s break-words text-text-2">{where}</p>}
          {note && <div className="mt-2 text-body-s text-text-1">{note}</div>}
        </div>
      </div>
      {actions && <div className="mt-5 flex flex-wrap items-center gap-3 max-sm:[&>*:first-child]:flex-1">{actions}</div>}
      {children && <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5">{children}</div>}
    </section>
  );
}

/** The card's mark: the server type's logo in a circle. */
export function CardMark({ kind, children }: { kind?: string; children?: ReactNode }) {
  return (
    <span aria-hidden className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-text-2 [&>svg]:size-6">
      {children ?? <ServerMark kind={kind ?? ""} className="size-7" />}
    </span>
  );
}

/** Every kind of server, for the guest and a profile without one: what "your servers" are, without a sentence. */
export function ServerMarks() {
  return (
    <span aria-hidden className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
      {["jellyfin", "plex", "torrserver"].map((k) => (
        <span key={k} className="grid size-12 place-items-center overflow-hidden rounded-full border-2 border-surface-1 bg-surface-2">
          <ServerMark kind={k} />
        </span>
      ))}
    </span>
  );
}

/** The card while its answer is on the way: the same layout; a search that takes a while says so in the heading's place. */
export function WatchCardLoading({ id, kind, status }: { id: string; kind?: string; status?: string }) {
  return (
    <WatchCard
      id={id}
      mark={kind ? <CardMark kind={kind} /> : <Skeleton shape="full" className="size-12 shrink-0" />}
      heading={
        <>
          {status && (
            <span className="sr-only" aria-live="polite">
              {status}
            </span>
          )}
          <Skeleton className="h-5 w-3/5 max-w-80" />
        </>
      }
      quality={<Skeleton className="h-4 w-2/5 max-w-56" />}
      where={status ? <span className="text-text-3">{status}</span> : <Skeleton className="h-3.5 w-1/3 max-w-44" />}
      actions={<Skeleton shape="full" className="h-12 w-40 max-sm:w-full" />}
    />
  );
}

// A menu's button, not a switch: no aria-pressed (as the catalog's filter pills, browse/BrowseView).
const NOT_TOGGLE = { "aria-pressed": undefined };

/**
 * A choice that leads to another release or copy (Plex's pickers before Play): a pill with the choice's name and its
 * value and a chevron — the catalog's filter pill, never "selected", since a value is always there. It opens a
 * Menu (`menu`), whose items are MenuCheckboxItems with the current one ticked.
 */
export const PickPill = forwardRef<HTMLButtonElement, { name: string; value: string; lead?: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">>(function PickPill(
  { name, value, lead, ...rest },
  ref,
) {
  // Menu's trigger (asChild) hands its handlers and ref through.
  return (
    <FilterChip ref={ref} selected={false} {...rest} {...NOT_TOGGLE}>
      <span className="font-medium text-text-2">{name}</span>
      {/* Before the value, what it is in a picture: the chosen studio's mark. */}
      {lead}
      <span className="max-w-48 truncate">{value}</span>
      <ChevronDown aria-hidden className="-me-0.5 size-4 shrink-0 text-text-2" />
    </FilterChip>
  );
});

/** A menu item's two lines: the option, then what it comes in. */
export function PickItem({ name, sub }: { name: ReactNode; sub?: string | null }) {
  return (
    <>
      <span className="block">{name}</span>
      {sub && <span className="block text-body-s text-text-2">{sub}</span>}
    </>
  );
}
