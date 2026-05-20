"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned. */
  footer?: ReactNode;
  className?: string;
};

/**
 * A centered overlay dialog. Closes on Escape or backdrop click; locks
 * body scroll while open. Render it unconditionally — it returns null
 * when `open` is false.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-fade-up relative w-full max-w-md rounded-2xl border border-line-soft bg-surface-1 shadow-glass",
          className,
        )}
      >
        {(title || description) && (
          <div className="border-b border-line-soft px-5 py-4">
            {title && (
              <h2 className="text-sm font-semibold text-text-primary">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-text-secondary">{description}</p>
            )}
          </div>
        )}
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
