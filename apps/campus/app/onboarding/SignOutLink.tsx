"use client";

import { Button } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut } from "next-auth/react";

export default function SignOutLink() {
  return (
    <Button
      variant="outlined"
      startIcon={<LogoutIcon />}
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      sx={{ textTransform: "none" }}
    >
      Sign out
    </Button>
  );
}
