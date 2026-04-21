"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ToastContainer } from "react-toastify";
import { ThemeModeProvider } from "@klorad/ui";

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
        {children}
        <ToastContainer position="bottom-right" theme="dark" />
      </ThemeModeProvider>
    </SessionProvider>
  );
}
