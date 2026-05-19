import "@/app/global.css";
import "react-toastify/dist/ReactToastify.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Klorad Campus",
    template: "%s · Klorad Campus",
  },
  description:
    "Self-service 3D campus maps for Greek higher education — indoor wayfinding, accessibility layers, events integration, and a five-minute CMS.",
  icons: {
    icon: "/klorad-favicon.png",
    shortcut: "/klorad-favicon.png",
    apple: "/klorad-favicon.png",
  },
  openGraph: {
    title: "Klorad Campus",
    description:
      "Self-service 3D campus maps for Greek higher education.",
    type: "website",
    locale: "en_US",
    alternateLocale: "el_GR",
    siteName: "Klorad Campus",
    images: [{ url: "/images/logo/klorad-campus-logo-black.svg", width: 650, height: 128, alt: "Klorad Campus" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Klorad Campus",
    description:
      "Self-service 3D campus maps for Greek higher education.",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('klorad-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
