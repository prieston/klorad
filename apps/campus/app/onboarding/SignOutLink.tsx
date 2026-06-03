"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@klorad/design-system";

export default function SignOutLink() {
  return (
    <Button
      variant="secondary"
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
    >
      <LogOut size={16} strokeWidth={1.75} aria-hidden />
      Sign out
    </Button>
  );
}
