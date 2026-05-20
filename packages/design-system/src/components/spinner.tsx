import { cn } from "../utils/cn";

export type SpinnerProps = {
  /** Diameter in pixels. Default 20. */
  size?: number;
  className?: string;
};

/** An indeterminate loading spinner. */
export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-line-strong border-t-accent",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
