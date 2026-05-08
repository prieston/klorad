"use client";

import React from "react";
import MuiAutocomplete, {
  AutocompleteProps as MuiAutocompleteProps,
} from "@mui/material/Autocomplete";

// Default popover z-index: MUI's tooltip tier (1500). Same reason as
// Select — autocompletes often sit inside floating glass panels with
// their own zIndex: 1400, and the default modal tier (1300) would
// render the listbox underneath them.
const defaultSlotProps = {
  popper: {
    sx: { zIndex: (t: { zIndex: { tooltip: number } }) => t.zIndex.tooltip },
  },
};

export type AutocompleteProps<
  T,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
> = MuiAutocompleteProps<T, Multiple, DisableClearable, FreeSolo>;

/**
 * Klorad's design-system Autocomplete.
 *
 * Pass-through wrapper that bumps the listbox popper above the
 * floating glass panels. The caller still owns `renderInput` — point
 * it at the @klorad/ui TextField so the brand styles land on the
 * input itself.
 */
export const Autocomplete = React.forwardRef(function Autocomplete<
  T,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>(
  {
    slotProps,
    ...props
  }: AutocompleteProps<T, Multiple, DisableClearable, FreeSolo>,
  ref: React.Ref<unknown>
) {
  const mergedSlotProps = {
    ...defaultSlotProps,
    ...slotProps,
    popper: {
      ...defaultSlotProps.popper,
      ...(slotProps?.popper ?? {}),
    },
  };
  return (
    <MuiAutocomplete
      ref={ref as React.Ref<HTMLDivElement>}
      {...(props as MuiAutocompleteProps<T, Multiple, DisableClearable, FreeSolo>)}
      slotProps={mergedSlotProps as MuiAutocompleteProps<
        T,
        Multiple,
        DisableClearable,
        FreeSolo
      >["slotProps"]}
    />
  );
}) as <
  T,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>(
  p: AutocompleteProps<T, Multiple, DisableClearable, FreeSolo> & {
    ref?: React.Ref<unknown>;
  }
) => React.ReactElement;
