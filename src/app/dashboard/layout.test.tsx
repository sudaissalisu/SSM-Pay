import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardLayout from './layout';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ''} />;
  },
}));

// Mock next/link
vi.mock('next/link', () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

// Mock placeholder images
vi.mock('@/lib/placeholder-images', () => ({
  PlaceHolderImages: [
    {
      id: 'user-avatar',
      imageUrl: '/placeholder-avatar.jpg',
      description: 'User Avatar',
      imageHint: 'avatar',
    },
  ],
}));

describe('DashboardLayout', () => {
  const renderWithChildren = (children: React.ReactNode = <div>Test Content</div>) => {
    return render(<DashboardLayout>{children}</DashboardLayout>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderWithChildren();
    expect(screen.getByText(/Test Content/i)).toBeInTheDocument();
  });

  it('renders sidebar with Zainpay branding', () => {
    renderWithChildren();
    expect(screen.getByText(/Zainpay/i)).toBeInTheDocument();
  });

  it('renders Dashboard navigation link', () => {
    renderWithChildren();
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  it('renders Create Zainbox navigation link', () => {
    renderWithChildren();
    const createLink = screen.getByRole('link', { name: /Create Zainbox/i });
    expect(createLink).toBeInTheDocument();
    expect(createLink).toHaveAttribute('href', '/dashboard/zainbox/create');
  });

  it('renders List Zainboxes navigation link', () => {
    renderWithChildren();
    const listLink = screen.getByRole('link', { name: /List Zainboxes/i });
    expect(listLink).toBeInTheDocument();
    expect(listLink).toHaveAttribute('href', '/dashboard/zainbox/list');
  });

  it('renders New Payment navigation link', () => {
    renderWithChildren();
    const paymentLink = screen.getByRole('link', { name: /New Payment/i });
    expect(paymentLink).toBeInTheDocument();
    expect(paymentLink).toHaveAttribute('href', '/dashboard/payment');
  });

  it('renders user info in sidebar footer', () => {
    renderWithChildren();
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    expect(screen.getByText(/user@test.com/i)).toBeInTheDocument();
  });

  it('renders user avatar image', () => {
    renderWithChildren();
    const avatarImage = screen.getByAltText(/User Avatar/i);
    expect(avatarImage).toBeInTheDocument();
    expect(avatarImage).toHaveAttribute('src', '/placeholder-avatar.jpg');
  });

  it('renders main content area for children', () => {
    renderWithChildren(<main>Custom Content</main>);
    expect(screen.getByText(/Custom Content/i)).toBeInTheDocument();
  });

  it('renders header section with user menu trigger', () => {
    renderWithChildren();
    // User menu button should be present
    const userMenuButton = screen.getByRole('button', { name: /Toggle user menu/i });
    expect(userMenuButton).toBeInTheDocument();
  });

  it('has proper layout structure with sidebar and content area', () => {
    const { container } = renderWithChildren();
    
    // Should have data-sidebar elements
    const sidebarElements = container.querySelectorAll('[data-sidebar]');
    expect(sidebarElements.length).toBeGreaterThan(0);
  });

  it('renders all four navigation items in sidebar', () => {
    renderWithChildren();
    const navLinks = screen.getAllByRole('link');
    // Should have at least 4 navigation links
    const dashboardNavLinks = navLinks.filter(
      (link) =>
        link.getAttribute('href')?.startsWith('/dashboard')
    );
    expect(dashboardNavLinks.length).toBeGreaterThanOrEqual(4);
  });
});
