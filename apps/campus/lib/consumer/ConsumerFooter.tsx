export interface ConsumerFooterProps {
  /** Display name of the campus — appears in the "Built for …" line. */
  campusName: string;
}

/**
 * Centered, low-weight footer. Per [[campus-consumer-pivot]] the
 * line reads "Built for {Campus} · Powered by Klorad" to preserve
 * the multi-tenant story.
 */
export function ConsumerFooter({ campusName }: ConsumerFooterProps) {
  return (
    <footer className="mx-auto mt-12 max-w-[1280px] px-4 pb-10 pt-8 text-center md:px-6">
      <p className="text-xs text-[var(--brand-text-muted)]">
        Built for {campusName} · Powered by Klorad · privacy ·
        accessibility · contact
      </p>
    </footer>
  );
}
