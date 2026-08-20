import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from './page';

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
  useSearchParams: () => new URLSearchParams(),
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

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Welcome to the Zainpay Integration Kit/i)).toBeInTheDocument();
  });

  it('renders main heading with correct text', () => {
    render(<DashboardPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/Zainpay Integration Kit/i);
  });

  it('renders description text about payment APIs', () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/Build seamless payment experiences with our simple and robust APIs/i)
    ).toBeInTheDocument();
  });

  it('renders Zainbox Management card', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Zainbox Management/i)).toBeInTheDocument();
  });

  it('renders Virtual Accounts card', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Virtual Accounts/i)).toBeInTheDocument();
  });

  it('renders Payment Processing card', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Payment Processing/i)).toBeInTheDocument();
  });

  it('renders navigation link to create zainbox', () => {
    render(<DashboardPage />);
    const createLink = screen.getByRole('link', { name: /Create a Zainbox/i });
    expect(createLink).toBeInTheDocument();
    expect(createLink).toHaveAttribute('href', '/dashboard/zainbox/create');
  });

  it('renders navigation link to view zainboxes', () => {
    render(<DashboardPage />);
    const viewLink = screen.getByRole('link', { name: /View Zainboxes/i });
    expect(viewLink).toBeInTheDocument();
    expect(viewLink).toHaveAttribute('href', '/dashboard/zainbox/list');
  });

  it('renders navigation link to make a payment', () => {
    render(<DashboardPage />);
    const paymentLink = screen.getByRole('link', { name: /Make a Payment/i });
    expect(paymentLink).toBeInTheDocument();
    expect(paymentLink).toHaveAttribute('href', '/dashboard/payment');
  });

  it('displays description for Zainbox Management feature', () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/Create and manage Zainboxes, your virtual buckets for receiving payments/i)
    ).toBeInTheDocument();
  });

  it('displays description for Virtual Accounts feature', () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/View your existing Zainboxes and their associated virtual accounts/i)
    ).toBeInTheDocument();
  });

  it('displays description for Payment Processing feature', () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/Test the payment flow by initiating a sample transaction/i)
    ).toBeInTheDocument();
  });

  it('renders three action buttons in cards', () => {
    render(<DashboardPage />);
    const buttons = screen.getAllByRole('button');
    // Should have at least 3 buttons for the 3 cards
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('has proper grid layout for widget cards', () => {
    const { container } = render(<DashboardPage />);
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer?.className).toContain('grid-cols-2');
  });

  it('contains arrow icons in action buttons', () => {
    render(<DashboardPage />);
    // Arrow icons should be present in the buttons
    const arrowIcons = container.querySelectorAll('.ml-2');
    expect(arrowIcons.length).toBeGreaterThanOrEqual(3);
  });
});
