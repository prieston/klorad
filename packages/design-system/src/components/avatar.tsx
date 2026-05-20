import { cn } from "../utils/cn";

export type AvatarProps = {
  src?: string | null;
  /** Drives the initial fallback and the image alt text. */
  name?: string | null;
  /** Diameter in pixels. Default 32. */
  size?: number;
  className?: string;
};

/** A circular avatar — shows an image, or an initial fallback. */
export function Avatar({ src, name, size = 32, className }: AvatarProps) {
  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </span>
  );
}
