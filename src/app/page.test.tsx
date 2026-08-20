import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from './page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
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

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock getExchangeRate action
vi.mock('@/app/actions', () => ({
  getExchangeRate: vi.fn().mockResolvedValue({ buy: 1500, sell: 1600 }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<HomePage />);
    expect(screen.getByText(/SSM Pay/i)).toBeInTheDocument();
  });

  it('renders SSM Pay branding', () => {
    render(<HomePage />);
    
    // Check for logo and title
    const ssmLogo = screen.getByText(/SSM Pay/i);
    expect(ssmLogo).toBeInTheDocument();
  });

  it('renders payment form card', () => {
    render(<HomePage />);

    // Check for main heading
    expect(screen.getByText('Make a Payment')).toBeInTheDocument();

    // Check for description
    expect(
      screen.getByText(/Enter payment details below/)
    ).toBeInTheDocument();
  });

  it('renders email input field', () => {
    render(<HomePage />);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('name', 'email');
  });

  it('renders mobile number input field', () => {
    render(<HomePage />);

    const mobileInput = screen.getByLabelText(/mobile number/i);
    expect(mobileInput).toBeInTheDocument();
    expect(mobileInput).toHaveAttribute('type', 'tel');
    expect(mobileInput).toHaveAttribute('name', 'mobileNumber');
  });

  it('renders amount input field', () => {
    render(<HomePage />);

    const amountInput = screen.getByLabelText(/amount/i);
    expect(amountInput).toBeInTheDocument();
    expect(amountInput).toHaveAttribute('type', 'number');
    expect(amountInput).toHaveAttribute('name', 'amount');
  });

  it('renders currency selector', () => {
    render(<HomePage />);

    const currencySelector = screen.getByLabelText(/currency/i);
    expect(currencySelector).toBeInTheDocument();
  });

  it('renders submit button with correct text', () => {
    render(<HomePage />);

    const submitButton = screen.getByRole('button', { name: /proceed to payment/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveTextContent(/proceed to payment/i);
  });

  it('has navigation elements or interactive components', () => {
    render(<HomePage />);

    // The page should have a submit button (interactive element)
    const submitButton = screen.getByRole('button', { name: /proceed to payment/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('allows entering email address', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const emailInput = screen.getByLabelText(/email address/i);
    // Clear default value first
    await user.clear(emailInput);
    await user.type(emailInput, 'customer@example.com');

    expect(emailInput).toHaveValue('customer@example.com');
  });

  it('allows entering mobile number', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const mobileInput = screen.getByLabelText(/mobile number/i);
    // Clear default value first
    await user.clear(mobileInput);
    await user.type(mobileInput, '08012345678');

    expect(mobileInput).toHaveValue('08012345678');
  });

  it('allows entering amount', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '5000');

    // Number input returns numeric value
    expect(amountInput).toHaveValue(5000);
  });

  it('shows exchange rate disclaimer text', () => {
    render(<HomePage />);

    expect(
      screen.getByText(/exchange rates are updated in real-time/i)
    ).toBeInTheDocument();
  });

  it('renders page with proper layout structure', () => {
    const { container } = render(<HomePage />);

    // Should have a form element
    expect(container.querySelector('form')).toBeInTheDocument();

    // Main container should exist
    expect(container.firstChild).toBeTruthy();
  });

  it('displays SSM Logo icon component', () => {
    render(<HomePage />);

    // SSMLogo should be rendered as an SVG
    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('submit button contains arrow icon', () => {
    render(<HomePage />);

    const submitButton = screen.getByRole('button', { name: /proceed to payment/i });
    const iconsInButton = submitButton.querySelectorAll('svg');
    expect(iconsInButton.length).toBeGreaterThan(0);
  });

  it('has required fields marked properly', () => {
    render(<HomePage />);

    const emailInput = screen.getByLabelText(/email address/i);
    const mobileInput = screen.getByLabelText(/mobile number/i);
    const amountInput = screen.getByLabelText(/amount/i);

    expect(emailInput).toBeRequired();
    expect(mobileInput).toBeRequired();
    expect(amountInput).toBeRequired();
  });
});
