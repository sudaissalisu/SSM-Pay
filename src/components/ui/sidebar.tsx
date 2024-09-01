// Sidebar components - split into modules for better maintainability
// Re-exporting all sidebar components from their respective modules

// Provider and context
export {
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_MOBILE,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SidebarContext,
  useSidebar,
  SidebarProvider,
} from "./sidebar-provider"
export type { SidebarContextType } from "./sidebar-provider"

// Main sidebar component
export { Sidebar } from "./sidebar-main"

// UI components (trigger, rail, inset, input, header, footer, etc.)
export {
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenuSkeleton,
} from "./sidebar-components"

// Menu components
export {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  sidebarMenuButtonVariants,
} from "./sidebar-menu"
