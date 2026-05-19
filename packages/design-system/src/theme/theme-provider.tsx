"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes for every Klorad app. The theme is applied via the
 * `.dark` class on <html>, matching the Tailwind preset (darkMode: "class").
 *
 * New visitors get the light theme by default — the OS preference is not
 * used. The toggle still lets visitors switch to dark, and that choice is
 * remembered. Apps that want different behaviour can override via props.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
