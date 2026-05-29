"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";

interface Props {
  /** Article title — surfaced as the `title` of the native share sheet. */
  title: string;
  /** Article URL (relative is fine — resolved against `location.origin`). */
  url: string;
  /** Optional short summary fed to the share sheet's `text`. */
  text?: string;
  /** Button label — defaults to "Share". */
  label?: string;
}

/**
 * Primary share affordance for the news / event detail pages.
 * Tries the native `navigator.share` first (iOS / Android show the
 * system share sheet); falls back to `navigator.clipboard.writeText`
 * so desktop visitors get a copied link with visual confirmation.
 */
export function ShareButton({ title, url, text, label = "Share" }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const absoluteUrl =
      typeof window !== "undefined"
        ? new URL(url, window.location.origin).toString()
        : url;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        return;
      } catch {
        /* user cancelled or share failed — fall through to clipboard */
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: "var(--brand-primary)" }}
    >
      {copied ? (
        <>
          <Check size={16} strokeWidth={2} />
          Link copied
        </>
      ) : (
        <>
          <Send size={16} strokeWidth={2} />
          {label}
        </>
      )}
    </button>
  );
}
