import { ExternalLink } from "lucide-react";
import { Button } from "@klorad/design-system";

interface Props {
  /** Public-side route to open in a new tab. */
  href: string;
  /** Override label — defaults to "Open public". */
  label?: string;
}

/**
 * The "Open public" pill that sits in every public-surface authoring
 * screen's header. Wraps the design-system `Button` in a target=_blank
 * anchor so the rector can compare draft + public state side by side
 * on a real second monitor — the in-page `PhonePreview` covers the
 * single-monitor flow.
 */
export function OpenPublicAction({ href, label = "Open public" }: Props) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Button size="sm" variant="secondary">
        <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
        {label}
      </Button>
    </a>
  );
}
