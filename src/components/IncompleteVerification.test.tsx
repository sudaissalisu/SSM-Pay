import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncompleteVerification from './IncompleteVerification';

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('IncompleteVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all elements', () => {
    render(<IncompleteVerification />);

    // Check for alert icon (AlertTriangle) - SVG from lucide-react
    const alertIcon = document.querySelector('.lucide-triangle-alert');
    expect(alertIcon).toBeInTheDocument();

    // Check for title
    expect(screen.getByText('Verification Incomplete')).toBeInTheDocument();

    // Check for description text
    expect(
      screen.getByText(/Could not retrieve complete transaction details/)
    ).toBeInTheDocument();

    // Check for refresh button
    expect(screen.getByRole('button', { name: /refresh status/i })).toBeInTheDocument();
  });

  it('displays the warning icon with correct styling', () => {
    render(<IncompleteVerification />);

    const alertIcon = document.querySelector('.lucide-triangle-alert');
    expect(alertIcon).toHaveClass('w-16', 'h-16', 'text-yellow-500');
  });

  it('renders card title with correct class', () => {
    render(<IncompleteVerification />);

    const title = screen.getByText('Verification Incomplete');
    expect(title).toHaveClass('font-headline');
  });

  it('renders description about transaction processing', () => {
    render(<IncompleteVerification />);

    expect(
      screen.getByText(/transaction is still processing/i)
    ).toBeInTheDocument();
  });

  it('calls router.refresh when button is clicked', async () => {
    const user = userEvent.setup();
    render(<IncompleteVerification />);

    const refreshButton = screen.getByRole('button', { name: /refresh status/i });
    await user.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('button contains RefreshCw icon and correct text', () => {
    render(<IncompleteVerification />);

    const button = screen.getByRole('button', { name: /refresh status/i });
    expect(button).toHaveTextContent('Refresh Status');
    
    // Button should have an SVG icon inside (RefreshCw)
    const icons = button.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('button has full width styling', () => {
    render(<IncompleteVerification />);

    const button = screen.getByRole('button', { name: /refresh status/i });
    expect(button).toHaveClass('w-full');
  });

  it('renders within CardHeader and CardContent structure', () => {
    const { container } = render(<IncompleteVerification />);

    // Verify component renders without crashing
    expect(container.firstChild).toBeTruthy();
    expect(container.children.length).toBeGreaterThan(0);
  });

  it('displays helpful error message to user', () => {
    render(<IncompleteVerification />);

    // The component should explain what might be wrong
    const description = screen.getByText(/Could not retrieve complete transaction details/);
    expect(description).toBeInTheDocument();
    expect(description.textContent).toContain('processing');
  });
});
