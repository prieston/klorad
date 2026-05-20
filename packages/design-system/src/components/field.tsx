import type { ComponentProps, ReactNode } from "react";
import { cn } from "../utils/cn";

const controlClass =
  "w-full rounded-md border border-line-strong bg-surface-1 px-3 py-2 text-sm " +
  "text-text-primary outline-none transition-colors placeholder:text-text-tertiary " +
  "focus:border-accent disabled:cursor-not-allowed disabled:opacity-50";

/** A single-line text input, styled to the design system. */
export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(controlClass, className)} {...props} />;
}

/** A multi-line text input. */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(controlClass, "resize-y", className)} {...props} />
  );
}

export type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

/** A labelled form row — wraps any control with a label and a hint/error line. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}
