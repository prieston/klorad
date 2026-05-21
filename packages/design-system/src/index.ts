/**
 * @klorad/design-system — the shared visual backbone for every Klorad app.
 *
 * - Design tokens: `@klorad/design-system/tokens.css`
 * - Tailwind preset: `@klorad/design-system/tailwind-preset`
 * - Theme + components: this entry point
 */

export { cn } from "./utils/cn";

export { ThemeProvider } from "./theme/theme-provider";
export { ThemeToggle } from "./theme/theme-toggle";

export { KloradMark, type KloradMarkProps } from "./components/klorad-mark";
export {
  Button,
  IconButton,
  buttonClassName,
  iconButtonClassName,
  type ButtonProps,
  type IconButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from "./components/button";
export { Panel, type PanelProps, type PanelVariant } from "./components/panel";
export {
  Field,
  Input,
  Textarea,
  type FieldProps,
} from "./components/field";
export { Avatar, type AvatarProps } from "./components/avatar";
export { Badge, type BadgeProps, type BadgeTone } from "./components/badge";
export { Spinner, type SpinnerProps } from "./components/spinner";
export { Select, type SelectProps } from "./components/select";
export { Modal, type ModalProps } from "./components/modal";
export {
  Menu,
  MenuItem,
  type MenuProps,
  type MenuItemProps,
} from "./components/menu";
export {
  AppShell,
  type AppShellProps,
  type NavItem,
} from "./components/app-shell";
export { Dock, type DockProps } from "./components/dock";
export {
  Workbench,
  type WorkbenchProps,
  type WorkbenchToast,
} from "./components/workbench";
export {
  WorkbenchSection,
  WorkbenchStatTile,
  WorkbenchOperationButton,
  type WorkbenchSectionProps,
  type WorkbenchSectionTone,
  type WorkbenchStatTileProps,
  type WorkbenchOperationButtonProps,
} from "./components/workbench-primitives";
export {
  CommandPalette,
  type CommandPaletteProps,
} from "./components/command-palette";
