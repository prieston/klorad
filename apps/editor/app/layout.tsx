import "@/global.css";
import "react-toastify/dist/ReactToastify.css";
import { ReactNode } from "react";
import { Inter } from "next/font/google";
import { ThemeWrapper } from "./ThemeWrapper";
import { auth } from "@/auth";
import { SessionProviderWrapper } from "./components/SessionProviderWrapper";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "Klorad | Platform",
  description: "Control and publish immersive experiences with Klorad.",
  icons: { icon: "/klorad-favicon.png" },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable}`}>
      <head>
        {/* Editor is dark-only for now — force it on first paint so the
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
        <SessionProviderWrapper session={session}>
          <ThemeWrapper>{children}</ThemeWrapper>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
