"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download } from "lucide-react";

export interface QrShareProps {
  /**
   * URL to encode. Verticals typically pass the public-facing URL of
   * the resource being shared (`${origin}/campus/<token>` for a
   * Campus, `${origin}/w/<slug>` for a Mobility world).
   */
  url: string;
  /**
   * Filename (without extension) used when the visitor clicks
   * "Download QR". A `.svg` is appended by the primitive. Example:
   * `campus-<mapId>` or `mobility-<slug>`.
   */
  downloadFilename?: string;
  /** Panel title. Default: "Share". */
  title?: string;
  /** Panel subtitle. Default: "Scan the QR or copy the link". */
  subtitle?: string;
  /** Copy-button label. Default: "Copy link". */
  copyLabel?: string;
  /** Download-button label. Default: "Download QR". */
  downloadLabel?: string;
  /** Pixel size of the rendered QR. Default: 240. */
  size?: number;
  /**
   * Foreground colour for the QR dots. Default: `--brand-fg` var
   * falling back to `#1a1a1a`. Kept as a hex string so the qrcode
   * library can serialise it verbatim into the SVG.
   */
  darkColor?: string;
  /** Background colour. Default: white. */
  lightColor?: string;
}

/**
 * "Share" card that renders a QR code for a URL + a copy-link
 * button + a download-SVG button. SVG stays sharp at any zoom,
 * downloads clean into print / Figma / a physical poster without
 * rasterising.
 *
 * All computation is client-only (uses `navigator.clipboard`,
 * `URL.createObjectURL`, and the browser's atob). Renders a
 * skeleton until the QR resolves so SSR doesn't ship an empty
 * white square.
 *
 * Palette comes from the standard `--brand-*` CSS custom
 * properties (see `InstallPrompt` for the full list).
 */
export function QrShare({
  url,
  downloadFilename = "share",
  title = "Share",
  subtitle = "Scan the QR or copy the link",
  copyLabel = "Copy link",
  downloadLabel = "Download QR",
  size = 240,
  darkColor = "#1a1a1a",
  lightColor = "#ffffff",
}: QrShareProps) {
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      // `M` is the sweet spot between resilience + dot density at
      // typical phone-scan distance.
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: darkColor, light: lightColor },
      width: size,
    })
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [url, darkColor, lightColor, size]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / non-secure contexts — silently no-op; the
      // URL is still visible in the panel for a manual copy.
    }
  };

  const downloadQr = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${downloadFilename}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="rounded-2xl border border-[var(--brand-line,#e6e6ea)] bg-white p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--brand-text,#1a1a1a)]">
          {title}
        </h3>
        <p className="mt-1 text-xs text-[var(--brand-text-muted,#6b6b6b)]">
          {subtitle}
        </p>
      </header>

      <div
        className="mx-auto flex items-center justify-center rounded-xl bg-white p-3"
        style={{
          width: size + 24,
          height: size + 24,
          border: "1px solid var(--brand-line, #e6e6ea)",
        }}
      >
        {svg ? (
          <div
            aria-label={`QR code for ${url}`}
            style={{ width: size, height: size }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div
            aria-hidden
            className="animate-pulse rounded-md bg-[var(--brand-line,#e6e6ea)]"
            style={{ width: size, height: size }}
          />
        )}
      </div>

      <p className="mt-4 truncate text-center font-mono text-xs text-[var(--brand-text-muted,#6b6b6b)]">
        {url}
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line,#e6e6ea)] px-3 py-1.5 text-xs font-medium text-[var(--brand-text,#1a1a1a)] transition-colors hover:border-[var(--brand-primary,#534ab7)] hover:text-[var(--brand-primary,#534ab7)]"
        >
          {copied ? (
            <>
              <Check size={13} strokeWidth={2} />
              Copied
            </>
          ) : (
            <>
              <Copy size={13} strokeWidth={2} />
              {copyLabel}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={downloadQr}
          disabled={!svg}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line,#e6e6ea)] px-3 py-1.5 text-xs font-medium text-[var(--brand-text,#1a1a1a)] transition-colors hover:border-[var(--brand-primary,#534ab7)] hover:text-[var(--brand-primary,#534ab7)] disabled:opacity-40"
        >
          <Download size={13} strokeWidth={2} />
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}
