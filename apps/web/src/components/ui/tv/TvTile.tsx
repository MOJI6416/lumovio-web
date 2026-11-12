import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../cn";

/**
 * A TV tile: a big choice made of a picture and a caption — a profile on "Who's watching?",
 * a season — one stop of the remote, the lime ring and a little growth when focused, no fill of its own.
 */
export const TvTile = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function TvTile({ className, type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} className={cn("tv-focus flex flex-col items-center gap-4 rounded-md p-3 text-text-2 focus:text-text-1", className)} {...rest} />;
});
