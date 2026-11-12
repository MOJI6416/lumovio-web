"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComboboxOption, ComboboxProps } from "./Combobox";
import { cn } from "./cn";
import { filterOptions } from "./filter-options";
import { SearchInput } from "./Input";
import { useOnStage, usePortalContainer } from "./portal";
import { listItem, listPanel, selectTrigger } from "./Select";

/**
 * The full Combobox (Radix Popover with the search and the list): what ./Combobox's light field turns into once it's
 * needed (./lazy-swap). Opens at once with `defaultOpen`, takes the focus with `autoFocus`.
 */
export function ComboboxPopover<V extends string>({
  defaultOpen = false,
  autoFocus,
  ...props
}: ComboboxProps<V> & { defaultOpen?: boolean; autoFocus?: boolean }) {
  const { options, placeholder, emptyLabel, id, invalid, disabled, size = "md", className } = props;
  const t = useTranslations("ui");
  const container = usePortalContainer();
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const stage = useOnStage(open, trigger);
  const [query, setQuery] = useState("");
  const chosen = useMemo(
    () => new Set<string>(props.multiple ? props.value : props.value != null ? [props.value] : []),
    [props.multiple, props.value],
  );
  // Opened before it loaded: on the chosen option, as openChange does.
  const [active, setActive] = useState(() =>
    defaultOpen
      ? Math.max(
          0,
          options.findIndex((o) => chosen.has(o.value)),
        )
      : 0,
  );
  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  const shownText = options
    .filter((o) => chosen.has(o.value))
    .map((o) => o.label)
    .join(", ");

  const openChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(
        Math.max(
          0,
          options.findIndex((o) => chosen.has(o.value)),
        ),
      );
    }
  };

  const choose = (o: ComboboxOption<V> | undefined) => {
    if (!o || o.disabled) return;
    if (props.multiple) {
      const has = props.value.includes(o.value);
      props.onValueChange(has ? props.value.filter((v) => v !== o.value) : [...props.value, o.value]);
    } else {
      props.onValueChange(o.value);
      setOpen(false);
    }
  };

  // Keep the active option in view inside the list (never scrolls the page).
  useEffect(() => {
    const ul = list.current;
    const li = ul?.querySelector<HTMLElement>(`[data-active="true"]`);
    if (!ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight)
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight;
  }, [active, open]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1;
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (e.key in step) {
      e.preventDefault();
      setActive((a) => Math.min(last, Math.max(0, a + step[e.key]!)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          ref={trigger}
          type="button"
          // As the light field (./Combobox): a combobox; ↓/↑ open it, as Enter and Space do.
          // biome-ignore lint/a11y/useAriaPropsForRole: Popover.Trigger gives it aria-expanded and aria-controls
          role="combobox"
          onKeyDown={(e) => {
            if (open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
            e.preventDefault();
            openChange(true);
          }}
          id={id}
          // biome-ignore lint/a11y/noAutofocus: only when the light field it replaces had the focus
          autoFocus={autoFocus}
          aria-label={props["aria-label"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={invalid || undefined}
          data-placeholder={shownText || emptyLabel ? undefined : ""}
          className={cn(selectTrigger(size), className)}
        >
          <span className="min-w-0 truncate">{shownText || emptyLabel || placeholder}</span>
          <ChevronDown aria-hidden className={cn("shrink-0 text-text-2", size === "sm" ? "size-4" : "size-5")} />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          aria-label={props["aria-label"] ?? t("searchList")}
          className={cn(
            listPanel,
            "flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-72 max-w-(--radix-popover-content-available-width) flex-col p-2",
            stage && "stage",
          )}
        >
          <SearchInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-label={t("searchList")}
            aria-expanded
            aria-controls={shown.length ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {shown.length ? (
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-multiselectable={props.multiple || undefined}
              aria-label={props["aria-label"] ?? t("searchList")}
              className="relative mt-2 max-h-72 overflow-y-auto"
            >
              {shown.map((o, i) => {
                const on = chosen.has(o.value);
                return (
                  // The input keeps focus; the list is pointed at with aria-activedescendant (WAI-ARIA combobox).
                  // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the search field
                  <li
                    key={o.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={on}
                    aria-disabled={o.disabled || undefined}
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={cn(
                      listItem,
                      "data-[active=true]:bg-surface-3",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {on && <Check aria-hidden className="size-4 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p role="status" className="px-3 py-3 text-body-s text-text-2">
              {t("nothingFound")}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
