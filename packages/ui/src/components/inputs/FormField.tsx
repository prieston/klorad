"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface FormFieldProps {
  /** Label text shown above the input. */
  label?: React.ReactNode;
  /** Helper text shown below the input. */
  helperText?: React.ReactNode;
  /** Mark the field as required (red asterisk). */
  required?: boolean;
  /** Switch helper text to the error color. */
  error?: boolean;
  /** The input element (TextField, Select, etc.). */
  children: React.ReactNode;
  /** Optional id — associates the label with the input for accessibility. */
  htmlFor?: string;
  className?: string;
  /** Spacing between rows of fields. Defaults to 0. */
  gutterBottom?: boolean;
  /** Pass-through sx for the root wrapper (e.g. for flex layouts). */
  sx?: SxProps<Theme>;
}

/**
 * Stacked-label form wrapper. Renders a small label above the input and
 * optional helper text below. The input itself should NOT set its own
 * `label` prop — FormField owns the label.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  helperText,
  required,
  error,
  children,
  htmlFor,
  className,
  gutterBottom,
  sx,
}) => {
  const rootSx = Array.isArray(sx) ? sx : [sx];
  return (
    <Box className={className} sx={[{ mb: gutterBottom ? 2 : 0 }, ...rootSx]}>
      {label && (
        <Typography
          component="label"
          htmlFor={htmlFor}
          sx={{
            display: "block",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "text.secondary",
            mb: 0.75,
            lineHeight: 1.3,
          }}
        >
          {label}
          {required && (
            <Typography
              component="span"
              sx={{ color: "error.main", ml: 0.5, fontSize: "inherit" }}
            >
              *
            </Typography>
          )}
        </Typography>
      )}
      {children}
      {helperText && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.5,
            color: error ? "error.main" : "text.secondary",
            fontSize: "0.7rem",
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};
