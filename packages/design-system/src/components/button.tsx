import type { ComponentProps } from "react";
import { cn } from "../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary:
    "border border-line-strong text-text-primary hover:border-accent hover:text-accent",
  ghost: "text-text-secondary hover:bg-accent-soft hover:text-text-primary",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

/**
 * The design-system button class string. Use this on anything that can't
 * be a `<button>` — a Next.js `<Link>`, a mailto anchor, an external
 * `<a target="_blank">`. For a real button, prefer `<Button>`.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variantClass[variant], sizeClass[size], className);
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** The standard action button. Variants: primary, secondary, ghost, danger. */
export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}

/**
 * The design-system icon-button class string — same variants as
 * `buttonClassName`, but square (h-8 w-8 for sm, h-10 w-10 for md).
 */
export function iconButtonClassName({
  variant = "ghost",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    base,
    variantClass[variant],
    size === "sm" ? "h-8 w-8" : "h-10 w-10",
    className,
  );
}

export type IconButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** A square, icon-only button — same variants as Button. */
export function IconButton({
  variant = "ghost",
  size = "md",
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={iconButtonClassName({ variant, size, className })}
      {...props}
    />
  );
}
