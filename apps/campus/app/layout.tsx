import "@/app/global.css";
import "react-toastify/dist/ReactToastify.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Topos Campus",
    template: "%s · Topos Campus",
  },
  description:
    "Self-service 3D campus maps for Greek higher education — indoor wayfinding, accessibility layers, events integration, and a five-minute CMS.",
  icons: {
    icon: "/klorad-favicon.png",
    shortcut: "/klorad-favicon.png",
    apple: "/klorad-favicon.png",
  },
  openGraph: {
    title: "Topos Campus",
    description:
      "Self-service 3D campus maps for Greek higher education.",
    type: "website",
    locale: "en_US",
    alternateLocale: "el_GR",
    siteName: "Topos Campus",
    images: [{ url: "/images/logo/klorad-logo.svg", width: 650, height: 128, alt: "Topos Campus" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Topos Campus",
    description:
      "Self-service 3D campus maps for Greek higher education.",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className="dark">
      <head>
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
