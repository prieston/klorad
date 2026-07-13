/**
 * Minimal Next 15 root layout. This app is API-first; the only page
 * is the developer-facing landing at `/`.
 */
export const metadata = {
  title: "PSMdt-iNET Mock",
  description:
    "Mock Parsons/iNET ATMS surface + demo scenarios for PSMdt-iNET.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0b1120",
          color: "#e2e8f0",
          padding: "2rem",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
