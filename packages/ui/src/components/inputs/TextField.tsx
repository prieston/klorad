"use client";

import React from "react";
import MuiTextField, { TextFieldProps as MuiTextFieldProps } from "@mui/material/TextField";
import { textFieldStyles } from "../../styles/inputStyles";

export type TextFieldProps = MuiTextFieldProps;

/**
 * Klorad's design-system TextField.
 * Wraps MUI's TextField with the shared input styles pre-applied.
 * Consumer-provided sx is merged on top, so you can still override.
 */
export const TextField = React.forwardRef<HTMLDivElement, TextFieldProps>(
  function TextField({ sx, ...props }, ref) {
    const merged = Array.isArray(sx)
      ? [textFieldStyles, ...sx]
      : [textFieldStyles, sx];
    return <MuiTextField ref={ref} {...props} sx={merged} />;
  }
);
