import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar, SidebarProvider, useSidebar } from './ui-sidebar-main';
import * as React from 'react';

// Mock sidebar-provider for context
vi.mock('./sidebar-provider', () => ({
  useSidebar: () => ({
    isMobile: false,
    state: 'expanded',
    openMobile: false,
    setOpenMobile: vi.fn(),
  }),
  SIDEBAR_WIDTH_MOBILE: '18rem',
}));

// Mock sheet component
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="sheet" {...props}>
      {children}
    </div>
  ),
  SheetContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="sheet-content" {...props}>
      {children}
    </div>
  ),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <Sidebar data-testid="test-sidebar">
        <span>Sidebar Content</span>
      </Sidebar>
    );
    expect(container.querySelector('[data-testid="test-sidebar"]')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Sidebar>
        <span>Test Child Content</span>
      </Sidebar>
    );
    expect(screen.getByText(/Test Child Content/i)).toBeInTheDocument();
  });

  it('applies default side prop as left', () => {
    const { container } = render(
      <Sidebar>
        <span>Content</span>
      </Sidebar>
    );
    const sidebar = container.querySelector('[data-side]');
    expect(sidebar).toHaveAttribute('data-side', 'left');
  });

  it('renders with right side when specified', () => {
    const { container } = render(
      <Sidebar side="right">
        <span>Content</span>
      </Sidebar>
    );
    const sidebar = container.querySelector('[data-side]');
    expect(sidebar).toHaveAttribute('data-side', 'right');
  });

  it('applies default variant as sidebar', () => {
    const { container } = render(
      <Sidebar>
        <span>Content</span>
      </Sidebar>
    );
    const sidebar = container.querySelector('[data-variant]');
    expect(sidebar).toHaveAttribute('data-variant', 'sidebar');
  });

  it('renders with floating variant', () => {
    const { container } = render(
      <Sidebar variant="floating">
        <span>Content</span>
      </Sidebar>
    );
    const sidebar = container.querySelector('[data-variant]');
    expect(sidebar).toHaveAttribute('data-variant', 'floating');
  });

  it('renders with inset variant', () => {
    const { container } = render(
      <Sidebar variant="inset">
        <span>Content</span>
      </Sidebar>
    );
    const sidebar = container.querySelector('[data-variant]');
    expect(sidebar).toHaveAttribute('data-variant', 'inset');
  });

  it('applies custom className prop', () => {
    const { container } = render(
      <Sidebar className="custom-class">
        <span>Content</span>
      </Sidebar>
    );
    // Check that custom class is applied somewhere in the component
    const element = container.querySelector('.custom-class');
    expect(element).toBeInTheDocument();
  });

  it('has proper data-state attribute for expanded state', () => {
    const { container } = render(
      <Sidebar>
        <span>Content</span>
      </Sidebar>
    );
    const sidebar = container.querySelector('[data-state]');
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
  });

  it('contains inner div with data-sidebar attribute', () => {
    const { container } = render(
      <Sidebar>
        <span>Content</span>
      </Sidebar>
    );
    const innerSidebar = container.querySelector('[data-sidebar="sidebar"]');
    expect(innerSidebar).toBeInTheDocument();
  });

  it('supports collapsible none option', () => {
    const { container } = render(
      <Sidebar collapsible="none">
        <span>Content</span>
      </Sidebar>
    );
    // Should still render content
    expect(screen.getByText(/Content/i)).toBeInTheDocument();
  });
});
