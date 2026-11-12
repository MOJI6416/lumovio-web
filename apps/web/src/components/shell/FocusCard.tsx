import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The Focus template of a system page: the stage under the transparent header, a 440 card in the
 * middle with an icon, the page's h1, one line of text, an optional form (full width, fields aligned to the start —
 * a code to confirm) and the actions (`children`, the main one first). The 404, the error page and a page that
 * needs an account (GuestGatePanel) use it inside the shell, so the header and footer stay.
 */
export function FocusCard({
  icon: Icon,
  title,
  text,
  form,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  text?: ReactNode;
  /** A form under the text: its fields and its own submit button, at the card's full width. */
  form?: ReactNode;
  children?: ReactNode;
}) {
  return (
    // data-hero: the header lies over this stage transparently, as over a billboard.
    <section data-hero className="stage page-x -mt-16 flex min-h-[85svh] items-center justify-center bg-stage pt-24 pb-16">
      <div className="w-full max-w-110 rounded-lg border border-line bg-surface-1 p-6 text-center md:p-10">
        {Icon && (
          <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-surface-2 text-text-2">
            <Icon aria-hidden className="size-6" />
          </div>
        )}
        <h1 className="text-balance text-h2 text-text-1">{title}</h1>
        {text && <p className="mt-2 text-body text-text-2">{text}</p>}
        {form && <div className="mt-6 text-start">{form}</div>}
        {children && <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">{children}</div>}
      </div>
    </section>
  );
}
