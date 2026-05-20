import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Klorad | Admin Dashboard",
  description: "Admin dashboard for managing Klorad platform",
  icons: { icon: "/klorad-favicon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable}`}>
      <head>
        {/* Admin is dark-only for now — force it on first paint so the
            class is present before next-themes hydrates. Persisted under
            the same `klorad-theme` key the design-system reads from. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(typeof document!=='undefined'){document.documentElement.classList.add('dark');}if(typeof localStorage!=='undefined'){localStorage.setItem('klorad-theme','dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
