"use client";

import { Eye, EyeOff, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ForwardedRef,
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  useRef,
  useState,
} from "react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";
import { FIELD_HEIGHT as HEIGHT, type FieldSize, fieldBox, fieldFocus, inputClass } from "./styles";

/*
 * Text fields (design-system 7.6): 44 px (`size="lg"` — 48, forms on a phone), --surface-2 with a --line-2 border,
 * 15 px text; focus — a --focus border and a soft halo; an error — a --danger border (`invalid`), with the message
 * from Field. Give every field a label: Field, or `aria-label` when an icon says what it is (search).
 * `className` is for placement; on PasswordInput and SearchInput it goes to the wrapper.
 */

export type { FieldSize };

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: FieldSize;
  /** Draws the error border and sets `aria-invalid`; the message itself goes in Field's `error`. */
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClass, HEIGHT[size], className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBox, fieldFocus, "block min-h-24 resize-y px-3 py-3", className)}
      {...rest}
    />
  );
});

function assign<T>(ref: ForwardedRef<T>, el: T | null) {
  if (typeof ref === "function") ref(el);
  else if (ref) ref.current = el;
}

/** A password field with a show/hide button at its end. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function PasswordInput(
  { className, size = "md", invalid, ...rest },
  ref,
) {
  const t = useTranslations("ui");
  const [shown, setShown] = useState(false);
  return (
    <span className={cn("relative block w-full", className)}>
      <input
        ref={ref}
        type={shown ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, HEIGHT[size], "pe-12")}
        {...rest}
      />
      <span className="absolute inset-y-0 end-1 flex items-center">
        <IconButton
          size="sm"
          icon={shown ? EyeOff : Eye}
          label={t(shown ? "hidePassword" : "showPassword")}
          disabled={rest.disabled}
          onClick={() => setShown(!shown)}
        />
      </span>
    </span>
  );
});

/**
 * A search field: the magnifier at the start, a clear button at the end once there is text, `type="search"`
 * without the browser's own ×. Clearing fires the input's onChange with "" (or calls `onClear`) and keeps focus.
 */
export const SearchInput = forwardRef<HTMLInputElement, Omit<InputProps, "type"> & { onClear?: () => void }>(
  function SearchInput({ className, size = "md", invalid, onClear, onInput, ...rest }, ref) {
    const t = useTranslations("ui");
    const inner = useRef<HTMLInputElement | null>(null);
    const [typed, setTyped] = useState(Boolean(rest.defaultValue));
    const filled = rest.value !== undefined ? String(rest.value) !== "" : typed;

    const clear = () => {
      const el = inner.current;
      if (!el) return;
      if (onClear) onClear();
      else {
        // Set the value the way typing does, so React's onChange sees it (controlled or not).
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setTyped(false);
      el.focus();
    };

    return (
      <span className={cn("relative block w-full", className)}>
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-text-3" />
        <input
          ref={(el) => {
            inner.current = el;
            assign(ref, el);
          }}
          type="search"
          aria-invalid={invalid || undefined}
          className={cn(
            inputClass,
            HEIGHT[size],
            "ps-10 pe-12 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          )}
          onInput={(e) => {
            setTyped(e.currentTarget.value !== "");
            onInput?.(e);
          }}
          {...rest}
        />
        {filled && !rest.disabled && (
          <span className="absolute inset-y-0 end-1 flex items-center">
            <IconButton size="sm" icon={X} label={t("clear")} onClick={clear} />
          </span>
        )}
      </span>
    );
  },
);
