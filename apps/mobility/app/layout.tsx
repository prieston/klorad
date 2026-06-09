import "@/app/global.css";
import "react-toastify/dist/ReactToastify.css";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Klorad Mobility",
    template: "%s · Klorad Mobility",
  },
  description:
    "Traffic-management dashboard for transport authorities: ATMS device monitoring, live cameras, dynamic signs, and a public traveller map.",
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
