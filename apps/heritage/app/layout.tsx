import "@/app/global.css";
import "react-toastify/dist/ReactToastify.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import Providers from "./providers";

/**
 * Absolute base for generated metadata URLs.
 *
 * Load-bearing for oEmbed: §7.4.2 requires a working discovery endpoint, and a
 * relative `href` on the `<link rel="alternate" type="application/json+oembed">`
 * is resolvable in principle but is not what a consumer registry expects.
 * `metadataBase` makes Next absolutise every `alternates` URL.
 *
 * Derived from the environment rather than hard-coded so preview deployments
 * and custom domains advertise themselves correctly.
 */
const metadataBase = new URL(
  process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3005"),
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Klorad Heritage",
    template: "%s · Klorad Heritage",
  },
  description:
    "The institutional platform for photorealistic cultural heritage: scanned sites and captured artifacts, delivered in a browser and in a headset, holding the scientific record behind them.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('klorad-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
