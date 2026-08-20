import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from './ui-sidebar-menu';
import * as React from 'react';

// Mock sidebar-provider for context
vi.mock('./sidebar-provider', () => ({
  useSidebar: () => ({
    isMobile: false,
    state: 'expanded',
  }),
}));

// Mock tooltip component
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="tooltip-content" {...props}>
      {children}
    </div>
  ),
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('SidebarMenu Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SidebarMenu', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <SidebarMenu>
          <li>Menu Item</li>
        </SidebarMenu>
      );
      expect(container.querySelector('[data-sidebar="menu"]')).toBeInTheDocument();
    });

    it('renders as ul element with correct data attribute', () => {
      const { container } = render(
        <SidebarMenu>
          <li>Item</li>
        </SidebarMenu>
      );
      const menu = container.querySelector('ul[data-sidebar="menu"]');
      expect(menu).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <SidebarMenu className="custom-menu-class">
          <li>Item</li>
        </SidebarMenu>
      );
      const menu = container.querySelector('.custom-menu-class');
      expect(menu).toBeInTheDocument();
    });
  });

  describe('SidebarMenuItem', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <SidebarMenuItem>
          <span>Item Content</span>
        </SidebarMenuItem>
      );
      expect(container.querySelector('[data-sidebar="menu-item"]')).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(
        <SidebarMenuItem>
          <span>Test Item</span>
        </SidebarMenuItem>
      );
      expect(screen.getByText(/Test Item/i)).toBeInTheDocument();
    });

    it('has correct data attribute', () => {
      const { container } = render(<SidebarMenuItem>Content</SidebarMenuItem>);
      const item = container.querySelector('[data-sidebar="menu-item"]');
      expect(item).toBeInTheDocument();
    });
  });

  describe('SidebarMenuButton', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarMenuButton>Button Text</SidebarMenuButton>);
      expect(container.querySelector('[data-sidebar="menu-button"]')).toBeInTheDocument();
    });

    it('renders button text content', () => {
      render(<SidebarMenuButton>Click Me</SidebarMenuButton>);
      expect(screen.getByText(/Click Me/i)).toBeInTheDocument();
    });

    it('renders as button element by default', () => {
      const { container } = render(<SidebarMenuButton>Button</SidebarMenuButton>);
      const button = container.querySelector('button[data-sidebar="menu-button"]');
      expect(button).toBeInTheDocument();
    });

    it('applies active state when isActive is true', () => {
      const { container } = render(<SidebarMenuButton isActive>Active Button</SidebarMenuButton>);
      const button = container.querySelector('[data-active="true"]');
      expect(button).toBeInTheDocument();
    });

    it('shows tooltip when tooltip prop is provided', () => {
      render(<SidebarMenuButton tooltip="Dashboard">Dashboard</SidebarMenuButton>);
      // Tooltip should be rendered
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('does not show tooltip when no tooltip prop', () => {
      const { container } = render(<SidebarMenuButton>No Tooltip</SidebarMenuButton>);
      // No tooltip content should be present
      expect(container.querySelector('[data-testid="tooltip-content"]')).not.toBeInTheDocument();
    });

    it('supports size variants', () => {
      const { container } = render(
        <SidebarMenuButton size="lg">Large Button</SidebarMenuButton>
      );
      const button = container.querySelector('[data-size="lg"]');
      expect(button).toBeInTheDocument();
    });
  });

  describe('SidebarMenuAction', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarMenuAction>Action</SidebarMenuAction>);
      expect(container.querySelector('[data-sidebar="menu-action"]')).toBeInTheDocument();
    });

    it('has correct data attribute', () => {
      const { container } = render(<SidebarMenuAction>Icon</SidebarMenuAction>);
      const action = container.querySelector('[data-sidebar="menu-action"]');
      expect(action).toBeInTheDocument();
    });
  });

  describe('SidebarMenuBadge', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarMenuBadge>5</SidebarMenuBadge>);
      expect(container.querySelector('[data-sidebar="menu-badge"]')).toBeInTheDocument();
    });

    it('renders badge content', () => {
      render(<SidebarMenuBadge>New</SidebarMenuBadge>);
      expect(screen.getByText(/New/i)).toBeInTheDocument();
    });
  });

  describe('SidebarMenuSub', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <SidebarMenuSub>
          <li>Sub Item</li>
        </SidebarMenuSub>
      );
      expect(container.querySelector('[data-sidebar="menu-sub"]')).toBeInTheDocument();
    });

    it('has correct data attribute and styling', () => {
      const { container } = render(
        <SidebarMenuSub>
          <li>Item</li>
        </SidebarMenuSub>
      );
      const sub = container.querySelector('[data-sidebar="menu-sub"]');
      expect(sub).toBeInTheDocument();
      expect(sub?.className).toContain('border-l');
    });
  });

  describe('SidebarMenuSubButton', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarMenuSubButton>Sub Button</SidebarMenuSubButton>);
      expect(container.querySelector('[data-sidebar="menu-sub-button"]')).toBeInTheDocument();
    });

    it('renders anchor element by default', () => {
      const { container } = render(<SidebarMenuSubButton>Link</SidebarMenuSubButton>);
      const link = container.querySelector('a[data-sidebar="menu-sub-button"]');
      expect(link).toBeInTheDocument();
    });

    it('supports size prop', () => {
      const { container } = render(
        <SidebarMenuSubButton size="sm">Small Sub</SidebarMenuSubButton>
      );
      const button = container.querySelector('[data-size="sm"]');
      expect(button).toBeInTheDocument();
    });
  });
});
