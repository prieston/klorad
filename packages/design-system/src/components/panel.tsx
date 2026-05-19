import type { ComponentProps } from "react";
import { cn } from "../utils/cn";

export type PanelVariant = "surface" | "glass";

const variantClass: Record<PanelVariant, string> = {
  /* opaque elevated surface — the default for app content */
  surface: "bg-surface-1 border border-line-soft",
  /* translucent glass — for panels that float over a canvas */
  glass: "glass-panel",
};

export type PanelProps = ComponentProps<"div"> & {
  variant?: PanelVariant;
};

/** A surface container. Use `surface` for app content, `glass` to float over 3D. */
export function Panel({ variant = "surface", className, ...props }: PanelProps) {
  return (
    <div
      className={cn("rounded-xl", variantClass[variant], className)}
      {...props}
    />
  );
}
