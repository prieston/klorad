import type { ComponentProps } from "react";
import { cn } from "../utils/cn";

export type SelectProps = ComponentProps<"select"> & {
  /** Applied to the wrapper — use it for width (e.g. `w-40`). */
  className?: string;
};

/** A native select, styled to match the design-system inputs. */
export function Select({ className, ...props }: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(
          "w-full appearance-none rounded-md border border-line-strong bg-surface-1",
          "py-2 pl-3 pr-9 text-sm text-text-primary outline-none transition-colors",
          "focus:border-accent disabled:cursor-not-allowed disabled:opacity-50",
        )}
        {...props}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
