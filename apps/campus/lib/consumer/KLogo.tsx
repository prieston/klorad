/**
 * 28 × 28 rounded purple square with a white "K" — the brand mark
 * the consumer nav opens with. Falls back automatically to the
 * per-org brand colour because the bg uses `var(--brand-primary)`.
 */
export function KLogo({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-medium text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--brand-primary-fill)",
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
      }}
    >
      K
    </span>
  );
}
