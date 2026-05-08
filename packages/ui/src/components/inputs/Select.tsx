"use client";

import React from "react";
import MuiSelect, { SelectProps as MuiSelectProps } from "@mui/material/Select";
import MuiMenuItem, { MenuItemProps } from "@mui/material/MenuItem";
import { selectStyles, menuItemStyles } from "../../styles/inputStyles";

export type SelectProps<T = unknown> = MuiSelectProps<T>;

// Default popover z-index: MUI's tooltip tier (1500). Needed because
// Selects often live inside floating glass panels (wayfinding, toolbars)
// which run their own zIndex: 1400 + backdrop-filter — the default modal
// tier (1300) would render the menu underneath them.
const defaultMenuProps: MuiSelectProps["MenuProps"] = {
  sx: { zIndex: (t) => t.zIndex.tooltip },
};

/**
 * Klorad's design-system Select.
 * Wraps MUI's Select with the shared input styles pre-applied.
 */
export const Select = React.forwardRef(function Select<T = unknown>(
  { sx, MenuProps, ...props }: SelectProps<T>,
  ref: React.Ref<HTMLSelectElement>
) {
  const merged = Array.isArray(sx) ? [selectStyles, ...sx] : [selectStyles, sx];
  const mergedMenuProps: MuiSelectProps["MenuProps"] = {
    ...defaultMenuProps,
    ...MenuProps,
    sx: [
      ...(Array.isArray(defaultMenuProps.sx) ? defaultMenuProps.sx : [defaultMenuProps.sx]),
      ...(MenuProps?.sx
        ? Array.isArray(MenuProps.sx)
          ? MenuProps.sx
          : [MenuProps.sx]
        : []),
    ],
  };
  return (
    <MuiSelect
      ref={ref}
      {...(props as MuiSelectProps<T>)}
      sx={merged}
      MenuProps={mergedMenuProps}
    />
  );
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
