import "@/global.css";
import "react-toastify/dist/ReactToastify.css";
import { ReactNode } from "react";
import { ThemeWrapper } from "./ThemeWrapper";
import { auth } from "@/auth";
import { SessionProviderWrapper } from "./components/SessionProviderWrapper";

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
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(typeof document!=='undefined'){var root=document.documentElement;root.classList.add('dark');}if(typeof localStorage!=='undefined'){localStorage.setItem('klorad-theme-mode','dark');}}catch(e){}})();",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                background: linear-gradient(135deg, #0a0d10 0%, #14171a 50%, #1a1f24 100%);
                min-height: 100vh;
                margin: 0;
              }
            `,
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

