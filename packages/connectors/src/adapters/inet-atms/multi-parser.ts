/**
 * Minimal NTCIP 1203 MULTI parser.
 *
 * MULTI is the markup the ATMS sends back as `status.message` for
 * DMS signs. We need enough of it to render the sign face natively
 * in the operator drawer:
 *
 *   [pb<num>]  page break (optionally with a page number / colour args)
 *   [jp<n>]    page justification (1=top, 2=middle, 3=bottom)
 *   [jl<n>]    line justification (1=left, 2=center, 3=right, 4=full)
 *   [cf<n>]    colour foreground (0-9 amber/red/green/yellow etc.)
 *   [pt<n>]    page on/off times (ignored for now)
 *   [nl]       new line
 *
 * Plain text appears between markers. We tolerate unknown markers
 * by skipping them so a sign that uses something we don't model
 * still renders its text rather than blowing up.
 */

export interface DmsLine {
  text: string;
  /** 1=left, 2=center, 3=right, 4=full. Null = inherit page default. */
  justify: 1 | 2 | 3 | 4 | null;
  /** Colour index per NTCIP 1203 colour table (0-9). Null = default. */
  colour: number | null;
}

export interface DmsPage {
  lines: DmsLine[];
  /** 1=top, 2=middle, 3=bottom. Null = inherit. */
  justify: 1 | 2 | 3 | null;
}

export interface ParsedDmsMessage {
  pages: DmsPage[];
}

const MARKER = /\[([a-z]{2})([^\]]*)\]/g;

function parseInt2(arg: string): number | null {
  const n = Number.parseInt(arg, 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse a MULTI string into pages → lines → text. */
export function parseMulti(input: string): ParsedDmsMessage {
  const pages: DmsPage[] = [];
  let currentPage: DmsPage = { lines: [], justify: null };
  let currentLine: DmsLine = { text: "", justify: null, colour: null };

  const pushLine = () => {
    // Keep empty lines too — a leading [nl] is a sign-author choice.
    currentPage.lines.push(currentLine);
    currentLine = {
      text: "",
      justify: currentLine.justify,
      colour: currentLine.colour,
    };
  };
  const pushPage = () => {
    pushLine();
    pages.push(currentPage);
    currentPage = { lines: [], justify: null };
    currentLine = { text: "", justify: null, colour: null };
  };

  let last = 0;
  for (const match of input.matchAll(MARKER)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      currentLine.text += input.slice(last, idx);
    }
    last = idx + match[0].length;
    const code = match[1];
    const arg = match[2] ?? "";
    switch (code) {
      case "pb":
        // [pb] starts a new page (the first [pb] closes any text
        // before it as page 1). Numeric arg is the page number; we
        // append in order and ignore it.
        if (pages.length > 0 || currentPage.lines.length > 0 || currentLine.text.length > 0) {
          pushPage();
        }
        break;
      case "nl":
        pushLine();
        break;
      case "jp":
        currentPage.justify = (parseInt2(arg) as DmsPage["justify"]) ?? null;
        break;
      case "jl":
        currentLine.justify = (parseInt2(arg) as DmsLine["justify"]) ?? null;
        break;
      case "cf":
        currentLine.colour = parseInt2(arg);
        break;
      case "pt":
        // Page on/off timing — ignored; we don't animate yet.
        break;
      default:
        // Unknown marker — silently skip per the brief's tolerance
        // requirement.
        break;
    }
  }
  if (last < input.length) {
    currentLine.text += input.slice(last);
  }
  // Flush the trailing page/line if there's anything in them.
  if (currentPage.lines.length > 0 || currentLine.text.length > 0) {
    pushPage();
  }
  return { pages };
}
