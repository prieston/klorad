"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ToastContainer } from "react-toastify";
import { ThemeModeProvider } from "@klorad/ui";
import { SWRConfig } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export default function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeModeProvider>
        <SWRConfig
          value={{
            fetcher,
            keepPreviousData: true,
            revalidateOnFocus: false,
            revalidateIfStale: true,
            revalidateOnReconnect: true,
            dedupingInterval: 10_000,
            errorRetryCount: 2,
          }}
        >
          {children}
        </SWRConfig>
        <ToastContainer position="bottom-right" theme="dark" />
      </ThemeModeProvider>
    </SessionProvider>
  );
}
