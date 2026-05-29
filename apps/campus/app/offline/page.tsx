import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  description: "You're offline — reconnect to continue.",
  robots: { index: false, follow: false },
};

// Static at build time. The SW caches the resulting HTML at install
// and serves it when a navigation fails. No per-request data.
export const dynamic = "force-static";

/**
 * Offline fallback served by the SW when a campus navigation can't
 * reach the network and isn't already cached. Kept brand-neutral on
 * purpose — the SW caches one copy at install, before it knows which
 * tenant's `/campus/[token]` the visitor will later open, so
 * per-tenant branding isn't available here.
 *
 * Auto-recovers: the inline script reloads when `online` fires, so
 * the visitor lands back on the page they wanted without thinking
 * about which URL it was.
 */
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f7f7f8",
        color: "#1a1a1a",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      <main
        style={{
          maxWidth: 420,
          textAlign: "center",
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "#eef0f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          ⚡
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
          You&rsquo;re offline
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "#6b6b6b",
            margin: "0 0 20px",
          }}
        >
          We&rsquo;ll reload as soon as you&rsquo;re back. You can also try
          again now.
        </p>
        <button
          type="button"
          id="offline-retry"
          style={{
            display: "inline-block",
            padding: "10px 18px",
            borderRadius: 999,
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Try again
        </button>
      </main>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "addEventListener('online',function(){location.reload()});" +
            "var b=document.getElementById('offline-retry');" +
            "if(b)b.addEventListener('click',function(){location.reload()});",
        }}
      />
    </div>
  );
}
