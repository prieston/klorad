import "@/app/global.css";
import "react-toastify/dist/ReactToastify.css";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import Providers from "./providers";

export const metadata = {
  title: "Campus Maps",
  description: "Interactive 3D campus maps and guided tours.",
  icons: { icon: "/favicon.ico" },
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
