"use client";

import React from "react";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  Typography,
  type DrawerProps,
} from "@mui/material";
import { CloseIcon } from "../icons/Icons";

export interface RightDrawerProps {
  open: boolean;
  title: React.ReactNode;
  /** Main form/content area. */
  children: React.ReactNode;
  /** Footer slot — usually a Cancel + primary action pair. */
  actions?: React.ReactNode;
  onClose: () => void;
  /** Paper width. Accepts a responsive sx object or a plain string. */
  width?: DrawerProps["PaperProps"] extends { sx: infer S } ? S : object | string;
  /** Layer z-index. Defaults to 1500 (above the 1400 sidebar). */
  zIndex?: number;
}

/**
 * Klorad's right-anchored creation/edit drawer. Replaces centered dialogs
 * for longer-form actions (create project, invite member, upload asset, …).
 * Headerless dialogs / small confirms should stay as `<Dialog>`.
 */
export const RightDrawer: React.FC<RightDrawerProps> = ({
  open,
  title,
  children,
  actions,
  onClose,
  width = { xs: "100%", sm: "420px" },
  zIndex = 1500,
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex,
        "& .MuiBackdrop-root": { zIndex: zIndex - 1 },
      }}
      ModalProps={{ keepMounted: false, disableScrollLock: true }}
      PaperProps={{
        sx: (theme) => ({
          width,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A !important"
              : theme.palette.background.paper,
          borderLeft: "1px solid rgba(255, 255, 255, 0.05)",
          zIndex,
          "&.MuiPaper-root": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        }),
      }}
    >
      <Box
        sx={(theme) => ({
          p: 3,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A"
              : theme.palette.background.paper,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
        })}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          {typeof title === "string" ? (
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          ) : (
            title
          )}
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: "text.secondary",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {children}
        </Box>
        {actions && (
          <Box sx={{ display: "flex", gap: 2, mt: 3 }}>{actions}</Box>
        )}
      </Box>
    </Drawer>
  );
};
