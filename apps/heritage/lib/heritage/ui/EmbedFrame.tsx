import { ExternalLink } from "lucide-react";
import { KloradMark } from "@klorad/design-system";
import { ViewerCanvas } from "@/lib/heritage/ui/ViewerCanvas";

/**
 * The visual shell of an embed.
 *
 * Everything here earns its pixels inside someone else's page. The title and
 * the institution establish provenance, the rights statement travels with the
 * object because an embed that loses it defeats the point of a closed rights
 * vocabulary, and the outbound link is how a visitor reaches the full record —
 * which is also what makes an embed worth hosting from the institution's side.
 *
 * `target="_blank"` on every link: an embed is in an iframe, and navigating
 * the frame would replace the viewer with a full page inside a 640×400 box.
 */
export function EmbedFrame({
  title,
  subtitle,
  canonicalPath,
  rightsLabel,
  rightsUri,
  layers,
  proxies = [],
  openLabel = "Open the full record",
}: {
  title: string;
  subtitle: string | null;
  canonicalPath: string;
  rightsLabel: string | null;
  rightsUri: string | null;
  layers: { id: string; url: string; transform?: unknown }[];
  /** Localised accessible name for the outbound link. The only chrome string
   *  in an embed, and it is the one a screen reader announces. */
  openLabel?: string;
  proxies?: {
    id: string;
    shape: "box" | "sphere" | "cylinder" | "plane" | "mesh";
    transform: unknown;
    label: string | null;
  }[];
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">
        {layers.length > 0 ? (
          <ViewerCanvas
            layers={layers}
            proxies={proxies}
            className="!rounded-none h-full"
            height={0}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-xs text-text-tertiary">
              No model has been published for this record yet.
            </p>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-line-soft px-3 py-2">
        <a
          href={canonicalPath}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-baseline gap-2 no-underline"
        >
          <span className="truncate text-xs font-medium text-text-primary">
            {title}
          </span>
          {subtitle ? (
            <span className="truncate text-[11px] text-text-tertiary">
              {subtitle}
            </span>
          ) : null}
        </a>

        {rightsLabel ? (
          rightsUri ? (
            <a
              href={rightsUri}
              target="_blank"
              rel="noopener noreferrer license"
              className="shrink-0 text-[10px] text-text-tertiary hover:text-text-secondary"
            >
              {rightsLabel}
            </a>
          ) : (
            <span className="shrink-0 text-[10px] text-text-tertiary">
              {rightsLabel}
            </span>
          )
        ) : null}

        <a
          href={canonicalPath}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={openLabel}
          className="flex shrink-0 items-center gap-1 text-text-tertiary hover:text-accent"
        >
          <KloradMark className="h-3.5 w-auto" title="" />
          <ExternalLink size={11} strokeWidth={1.9} aria-hidden />
        </a>
      </footer>
    </div>
  );
}
