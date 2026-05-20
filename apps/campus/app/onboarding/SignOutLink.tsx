"use client";

import { signOut } from "next-auth/react";
import LogoutIcon from "@mui/icons-material/Logout";
import { Button } from "@klorad/design-system";

export default function SignOutLink() {
  return (
    <Button
      variant="secondary"
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
    >
      <LogoutIcon fontSize="small" />
      Sign out
    </Button>
  );
}
