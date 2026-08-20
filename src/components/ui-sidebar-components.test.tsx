import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
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
} from './ui-sidebar-components';
import * as React from 'react';

// Mock sidebar-provider for context
vi.mock('./sidebar-provider', () => ({
  useSidebar: () => ({
    isMobile: false,
    state: 'expanded',
    toggleSidebar: vi.fn(),
  }),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(
    ({ children, onClick, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }, ref: React.Ref<HTMLButtonElement>) => (
      <button ref={ref} className={className} onClick={onClick} {...props}>
        {children}
      </button>
    )
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef(
    ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>, ref: React.Ref<HTMLInputElement>) => (
      <input ref={ref} className={className} {...props} />
    )
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) => (
    <div role="separator" className={className} {...props} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
}));

describe('Sidebar Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SidebarTrigger', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarTrigger />);
      expect(container.querySelector('[data-sidebar="trigger"]')).toBeInTheDocument();
    });

    it('renders button with toggle text for screen readers', () => {
      render(<SidebarTrigger />);
      expect(screen.getByText(/Toggle Sidebar/i)).toBeInTheDocument();
    });

    it('has correct data attribute', () => {
      const { container } = render(<SidebarTrigger />);
      const trigger = container.querySelector('[data-sidebar="trigger"]');
      expect(trigger).toBeInTheDocument();
    });
  });

  describe('SidebarRail', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarRail />);
      expect(container.querySelector('[data-sidebar="rail"]')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
      render(<SidebarRail />);
      expect(screen.getByLabelText(/Toggle Sidebar/i)).toBeInTheDocument();
    });

    it('is a button element', () => {
      const { container } = render(<SidebarRail />);
      const rail = container.querySelector('button[data-sidebar="rail"]');
      expect(rail).toBeInTheDocument();
    });
  });

  describe('SidebarInset', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarInset>Main Content</SidebarInset>);
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(<SidebarInset><p>Content Area</p></SidebarInset>);
      expect(screen.getByText(/Content Area/i)).toBeInTheDocument();
    });

    it('applies proper styling classes', () => {
      const { container } = render(<SidebarInset>Content</SidebarInset>);
      const inset = container.querySelector('main');
      expect(inset?.className).toContain('flex-1');
    });
  });

  describe('SidebarInput', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarInput placeholder="Search..." />);
      expect(container.querySelector('[data-sidebar="input"]')).toBeInTheDocument();
    });

    it('renders input element', () => {
      render(<SidebarInput placeholder="Type here" />);
      const input = screen.getByPlaceholderText(/Type here/i);
      expect(input).toBeInTheDocument();
    });

    it('passes props to input element', () => {
      render(<SidebarInput defaultValue="test value" />);
      const input = screen.getByDisplayValue(/test value/i);
      expect(input).toBeInTheDocument();
    });
  });

  describe('SidebarHeader', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarHeader>Header Content</SidebarHeader>);
      expect(container.querySelector('[data-sidebar="header"]')).toBeInTheDocument();
    });

    it('renders header content', () => {
      render(<SidebarHeader><span>Logo</span></SidebarHeader>);
      expect(screen.getByText(/Logo/i)).toBeInTheDocument();
    });

    it('has correct data attribute', () => {
      const { container } = render(<SidebarHeader>Content</SidebarHeader>);
      const header = container.querySelector('[data-sidebar="header"]');
      expect(header).toBeInTheDocument();
    });
  });

  describe('SidebarFooter', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarFooter>Footer Content</SidebarFooter>);
      expect(container.querySelector('[data-sidebar="footer"]')).toBeInTheDocument();
    });

    it('renders footer content', () => {
      render(<FooterWrapper />);
      expect(screen.getByText(/User Info/i)).toBeInTheDocument();
    });

    it('has correct data attribute', () => {
      const { container } = render(<SidebarFooter>Content</SidebarFooter>);
      const footer = container.querySelector('[data-sidebar="footer"]');
      expect(footer).toBeInTheDocument();
    });
  });

  describe('SidebarContent', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarContent>Menu Items</SidebarContent>);
      expect(container.querySelector('[data-sidebar="content"]')).toBeInTheDocument();
    });

    it('renders content children', () => {
      render(<SidebarContent><nav>Navigation</nav></SidebarContent>);
      expect(screen.getByText(/Navigation/i)).toBeInTheDocument();
    });
  });

  describe('SidebarSeparator', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarSeparator />);
      expect(container.querySelector('[data-sidebar="separator"]')).toBeInTheDocument();
    });

    it('renders as separator role', () => {
      render(<SidebarSeparator />);
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
  });

  describe('SidebarGroup', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarGroup>Group Content</SidebarGroup>);
      expect(container.querySelector('[data-sidebar="group"]')).toBeInTheDocument();
    });

    it('renders group content', () => {
      render(<SidebarGroup><span>Group Title</span></SidebarGroup>);
      expect(screen.getByText(/Group Title/i)).toBeInTheDocument();
    });
  });

  describe('SidebarMenuSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<SidebarMenuSkeleton />);
      expect(container.querySelector('[data-sidebar="menu-skeleton"]')).toBeInTheDocument();
    });

    it('renders skeleton elements', () => {
      render(<SidebarMenuSkeleton showIcon />);
      const skeletons = screen.getAllByTestId('skeleton');
      // Should have at least one skeleton (text)
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// Helper component for testing Footer
function FooterWrapper() {
  return (
    <SidebarFooter>
      <span>User Info</span>
    </SidebarFooter>
  );
}
