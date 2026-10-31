"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as S } from "radix-ui";
import { useRef, useState } from "react";
import { cn } from "./cn";
import { focusBack } from "./layers";
import { useOnStage, usePortalContainer } from "./portal";
import { listItem, listPanel, type SelectProps, selectTrigger } from "./Select";

/**
 * The full Select (Radix Select): what ./Select's light field turns into once it's needed (./lazy-swap). Opens
 * at once with `defaultOpen` when the field was pressed before it loaded, and takes the focus with `autoFocus`.
 */
export function SelectRadix<V extends string>({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  invalid,
  disabled,
  size = "md",
  className,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  defaultOpen = false,
  autoFocus,
}: SelectProps<V> & { defaultOpen?: boolean; autoFocus?: boolean }) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(defaultOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  // Opened from a stage (the player's settings, the sources screen): the list is dark there too (3.5).
  const stage = useOnStage(open, trigger);
  return (
    <S.Root
      value={value}
      onValueChange={(v) => onValueChange(v as V)}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <S.Trigger
        ref={trigger}
        id={id}
        // Only when the light field it replaces had the focus.
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(selectTrigger(size), className)}
      >
        <span className="min-w-0 truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon asChild>
          <ChevronDown
            aria-hidden
            className={cn("shrink-0 text-text-2", size === "sm" ? "size-4" : "size-5")}
          />
        </S.Icon>
      </S.Trigger>
      <S.Portal container={container}>
        <S.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          // Back to the field as Radix does, without the keyboard's ring after a pointer (layers.focusBack).
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (trigger.current) focusBack(trigger.current);
          }}
          className={cn(
            listPanel,
            "max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) max-w-(--radix-select-content-available-width)",
            stage && "stage",
          )}
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cn(listItem, "pe-9 data-highlighted:bg-surface-3")}
              >
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator className="absolute end-3 inline-flex">
                  <Check aria-hidden className="size-4" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
