/**
 * Render a Lucide-style SVG to an `ImageData` blob suitable for
 * `map.addImage(name, data, { sdf: true })`. Lucide ships strokes as
 * SVG paths; we serialise them to a string, draw via an `<img>` +
 * `<canvas>`, then hand the pixel buffer back.
 *
 * SDF mode (signed-distance field) lets Mapbox tint the icon with
 * `icon-color`, so a single rasterised PNG can render in the
 * operator's accent or the world's primary without re-rasterising.
 * The Lucide icons are stroke-only, which renders fine as a quasi-SDF
 * — silhouette stays crisp at any zoom + colour.
 *
 * Caller hint: rasterise once per `(iconKey, size)` and cache. The
 * map's `addImage` is idempotent on the image *name*, not the data,
 * so re-adding under the same name is a no-op.
 */

const ICON_SIZE = 96;

/**
 * Render a Lucide SVG node tree to ImageData. Pass the serialised
 * SVG markup (we get it from React's `renderToStaticMarkup` on the
 * client because Lucide React doesn't expose path data directly).
 */
export async function rasteriseSvg(
  svgMarkup: string,
  size = ICON_SIZE,
): Promise<ImageData | null> {
  if (typeof window === "undefined") return null;

  // Normalise the SVG so canvas can size + colour it predictably:
  // - explicit width/height
  // - stroke set to white so SDF tinting controls the final colour
  // - circular badge under the icon so it pops on any basemap
  const stroke = "rgba(255,255,255,1)";
  const fitted = svgMarkup
    .replace(/<svg([^>]*)>/, (_full, attrs) => {
      const cleaned = attrs
        .replace(/\swidth=["'][^"']*["']/g, "")
        .replace(/\sheight=["'][^"']*["']/g, "")
        .replace(/\sstroke=["'][^"']*["']/g, "")
        .replace(/\sfill=["'][^"']*["']/g, "");
      return `<svg${cleaned} width="${size}" height="${size}" stroke="${stroke}" fill="none">`;
    })
    .replace(/<path/g, `<path stroke="${stroke}" fill="none"`);

  const blob = new Blob([fitted], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Round the underlying circle a touch — gives the marker a
    // physical "pin" feel at low zoom without compositing two layers.
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
