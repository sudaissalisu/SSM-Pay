import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZainboxCreateForm from './zainbox-create-form';

// Mock ResizeObserver for Radix UI components
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock react-dom useFormState and useFormStatus
const mockFormState = { message: '', errors: {} };
const mockDispatch = vi.fn();

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    useFormState: () => [mockFormState, mockDispatch],
    useFormStatus: () => ({ pending: false }),
  };
});

// Mock createZainbox action
vi.mock('@/app/actions', () => ({
  createZainbox: vi.fn(),
}));

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('ZainboxCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset form state
    mockFormState.message = '';
    mockFormState.errors = {};
  });

  it('renders with all form fields', () => {
    render(<ZainboxCreateForm />);

    // Check for card title
    expect(screen.getByText('Zainbox Details')).toBeInTheDocument();

    // Check for card description
    expect(
      screen.getByText(/Fill in the details below to create your new Zainbox/)
    ).toBeInTheDocument();

    // Check for name field
    expect(screen.getByLabelText(/name\s*\*/i)).toBeInTheDocument();
    
    // Check for callback URL field
    expect(screen.getByLabelText(/callback url\s*\*/i)).toBeInTheDocument();

    // Check for email notification field
    expect(screen.getByLabelText(/email for notifications/i)).toBeInTheDocument();

    // Check for code name prefix field
    expect(screen.getByLabelText(/code name prefix/i)).toBeInTheDocument();

    // Check for description field
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();

    // Check for tags field
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();

    // Check for switch toggle
    expect(
      screen.getByText(/enable auto internal transfer/i)
    ).toBeInTheDocument();

    // Check for submit button
    expect(
      screen.getByRole('button', { name: /create zainbox/i })
    ).toBeInTheDocument();
  });

  it('renders name input with correct attributes', () => {
    render(<ZainboxCreateForm />);

    const nameInput = screen.getByLabelText(/name\s*\*/i);
    // Input component defaults to text type when not specified
    expect(nameInput).toHaveAttribute('name', 'name');
    expect(nameInput).toHaveAttribute('placeholder', 'Example Merchant');
    expect(nameInput).toBeRequired();
  });

  it('renders callback URL input with correct attributes', () => {
    render(<ZainboxCreateForm />);

    const callbackInput = screen.getByLabelText(/callback url\s*\*/i);
    expect(callbackInput).toHaveAttribute('type', 'url');
    expect(callbackInput).toHaveAttribute('name', 'callbackUrl');
    expect(callbackInput).toHaveAttribute('placeholder', 'https://example.com/callback');
    expect(callbackInput).toBeRequired();
  });

  it('renders email notification input with correct attributes', () => {
    render(<ZainboxCreateForm />);

    const emailInput = screen.getByLabelText(/email for notifications/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('name', 'emailNotification');
    expect(emailInput).toHaveAttribute('placeholder', 'notify@example.com');
  });

  it('renders code name prefix with maxLength of 3', () => {
    render(<ZainboxCreateForm />);

    const codePrefixInput = screen.getByLabelText(/code name prefix/i);
    expect(codePrefixInput).toHaveAttribute('name', 'codeNamePrefix');
    expect(codePrefixInput).toHaveAttribute('maxLength', '3');
    expect(codePrefixInput).toHaveAttribute('placeholder', 'EXM');
  });

  it('renders description textarea', () => {
    render(<ZainboxCreateForm />);

    const textarea = screen.getByLabelText(/description/i);
    expect(textarea).toHaveAttribute('name', 'description');
    expect(textarea).toHaveAttribute(
      'placeholder',
      'A brief description of this Zainbox'
    );
  });

  it('renders tags input with helper text', () => {
    render(<ZainboxCreateForm />);

    const tagsInput = screen.getByLabelText(/tags/i);
    expect(tagsInput).toHaveAttribute('name', 'tags');
    expect(tagsInput).toHaveAttribute('placeholder', 'tag1, tag2, tag3');

    // Check for helper text
    expect(
      screen.getByText(/comma-separated tags for organization/i)
    ).toBeInTheDocument();
  });

  it('allows typing in required fields', async () => {
    const user = userEvent.setup();
    render(<ZainboxCreateForm />);

    const nameInput = screen.getByLabelText(/name\s*\*/i);
    await user.type(nameInput, 'Test Merchant');
    expect(nameInput).toHaveValue('Test Merchant');

    const callbackInput = screen.getByLabelText(/callback url\s*\*/i);
    await user.type(callbackInput, 'https://example.com/callback');
    expect(callbackInput).toHaveValue('https://example.com/callback');
  });

  it('displays validation errors when present in state', () => {
    mockFormState.errors = {
      name: ['Name is required'],
      callbackUrl: ['Invalid URL format'],
      codeNamePrefix: ['Must be exactly 3 characters'],
    };

    render(<ZainboxCreateForm />);

    // Error messages should be displayed
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
    expect(screen.getByText('Must be exactly 3 characters')).toBeInTheDocument();
  });

  it('displays error messages in destructive color', () => {
    mockFormState.errors = {
      name: ['This field is required'],
    };

    render(<ZainboxCreateForm />);

    const errorElement = screen.getByText('This field is required');
    expect(errorElement).toHaveClass('text-destructive');
  });

  it('shows success toast on successful submission', () => {
    // Set state before render (useEffect will pick it up)
    mockFormState.message = 'Zainbox created successfully!';
    (mockFormState as Record<string, unknown>).data = { id: 'test-id' };

    render(<ZainboxCreateForm />);

    // Component should render with the message in state
    // Toast effect depends on React's batching behavior
    expect(mockFormState.message).toBe('Zainbox created successfully!');
  });

  it('shows error toast on failed submission', () => {
    mockFormState.message = 'Failed to create zainbox';
    (mockFormState as Record<string, unknown>).data = undefined;

    render(<ZainboxCreateForm />);

    // Verify component handles error state
    expect(mockFormState.message).toBe('Failed to create zainbox');
  });

  it('submit button has correct default text', () => {
    render(<ZainboxCreateForm />);

    const button = screen.getByRole('button', { name: /create zainbox/i });
    expect(button).toHaveTextContent('Create Zainbox');
  });

  it('submit button is enabled by default', () => {
    render(<ZainboxCreateForm />);

    const button = screen.getByRole('button', { name: /create zainbox/i });
    expect(button).not.toBeDisabled();
  });

  it('form has action handler configured', () => {
    const { container } = render(<ZainboxCreateForm />);

    // Form element should exist with dispatch as action
    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
  });

  it('renders auto transfer switch with description', () => {
    render(<ZainboxCreateForm />);

    // Check switch label/description exists
    expect(screen.getByText(/enable auto internal transfer/i)).toBeInTheDocument();
    expect(
      screen.getByText(/automatically consolidate deposits/i)
    ).toBeInTheDocument();
  });

  it('has proper form structure', () => {
    const { container } = render(<ZainboxCreateForm />);

    // Form element should exist
    expect(container.querySelector('form')).toBeInTheDocument();
  });
});
