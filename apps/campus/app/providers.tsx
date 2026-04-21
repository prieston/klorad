"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ToastContainer } from "react-toastify";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3b82f6" },
    background: { default: "#0a0d10", paper: "#14171a" },
  },
  typography: { fontFamily: "Inter, system-ui, sans-serif" },
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
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
        <ToastContainer position="bottom-right" theme="dark" />
      </ThemeProvider>
    </SessionProvider>
  );
}
