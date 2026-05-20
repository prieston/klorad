import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@klorad/design-system";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Klorad | Build the virtual worlds of tomorrow",
    template: "%s | Klorad",
  },
  description:
    "Klorad is a geospatial platform for digital twins, a shared foundation that turns real places into living, data-driven worlds. The engine behind Klorad Campus, Mobility, Virtual Heritage, and Urban.",
  keywords: [
    "geospatial platform",
    "digital twin",
    "3D world engine",
    "campus mapping",
    "virtual heritage",
    "mobility",
    "urban infrastructure",
    "spatial computing",
  ],
  authors: [{ name: "Prieston Technologies" }],
  creator: "Prieston Technologies",
  publisher: "Prieston Technologies",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://klorad.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Klorad",
    title: "Klorad | Build the virtual worlds of tomorrow",
    description:
      "A geospatial platform for digital twins. One engine beneath Klorad Campus, Mobility, Virtual Heritage, and Urban.",
    images: [
      {
        url: "/klorad-logo.png",
        width: 1200,
        height: 630,
        alt: "Klorad, the geospatial platform for digital twins",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Klorad | Build the virtual worlds of tomorrow",
    description:
      "A geospatial platform for digital twins. One engine, many worlds.",
    images: ["/klorad-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/klorad-favicon-new.png",
    apple: "/klorad-favicon-new.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Klorad",
    description:
      "Klorad is a geospatial platform for digital twins, a shared foundation for building 3D, data-driven world applications.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://klorad.com",
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://klorad.com"}/klorad-logo.png`,
    founder: {
      "@type": "Organization",
      name: "Prieston Technologies",
    },
    sameAs: [],
  };

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
