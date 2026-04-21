"use client";

import React from "react";
import MuiSelect, { SelectProps as MuiSelectProps } from "@mui/material/Select";
import MuiMenuItem, { MenuItemProps } from "@mui/material/MenuItem";
import { selectStyles, menuItemStyles } from "../../styles/inputStyles";

export type SelectProps<T = unknown> = MuiSelectProps<T>;

/**
 * Klorad's design-system Select.
 * Wraps MUI's Select with the shared input styles pre-applied.
 */
export const Select = React.forwardRef(function Select<T = unknown>(
  { sx, ...props }: SelectProps<T>,
  ref: React.Ref<HTMLSelectElement>
) {
  const merged = Array.isArray(sx) ? [selectStyles, ...sx] : [selectStyles, sx];
  return <MuiSelect ref={ref} {...(props as MuiSelectProps<T>)} sx={merged} />;
}) as <T = unknown>(p: SelectProps<T> & { ref?: React.Ref<HTMLSelectElement> }) => React.ReactElement;

/**
 * MenuItem pre-styled for use inside the Klorad Select.
 */
export const MenuItem = React.forwardRef<HTMLLIElement, MenuItemProps>(
  function MenuItem({ sx, ...props }, ref) {
    const merged = Array.isArray(sx) ? [menuItemStyles, ...sx] : [menuItemStyles, sx];
    return <MuiMenuItem ref={ref} {...props} sx={merged} />;
  }
);
