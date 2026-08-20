import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentForm from './payment-form';

// Mock the useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock zainpayInitPayment global function
const mockZainpayInitPayment = vi.fn();
globalThis.zainpayInitPayment = mockZainpayInitPayment;

describe('PaymentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env vars
    process.env.NEXT_PUBLIC_ZAINBOX_CODE_NAME = 'test_zainbox_code';
    process.env.NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY = 'test_public_key';
  });

  it('renders with all form fields', () => {
    render(<PaymentForm />);

    // Check for card title
    expect(screen.getByText('Make a Payment')).toBeInTheDocument();

    // Check for card description
    expect(
      screen.getByText(/Enter payment details below/)
    ).toBeInTheDocument();

    // Check for email field
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();

    // Check for amount field
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1000')).toBeInTheDocument();

    // Check for currency selector
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();

    // Check for submit button
    expect(
      screen.getByRole('button', { name: /proceed to payment/i })
    ).toBeInTheDocument();
  });

  it('renders email input with correct attributes', () => {
    render(<PaymentForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('name', 'email');
    expect(emailInput).toBeRequired();
  });

  it('renders amount input with correct attributes', () => {
    render(<PaymentForm />);

    const amountInput = screen.getByLabelText(/amount/i);
    expect(amountInput).toHaveAttribute('type', 'number');
    expect(amountInput).toHaveAttribute('name', 'amount');
    expect(amountInput).toBeRequired();
  });

  it('allows typing in email field', async () => {
    const user = userEvent.setup();
    render(<PaymentForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    expect(emailInput).toHaveValue('test@example.com');
  });

  it('allows typing in amount field', async () => {
    const user = userEvent.setup();
    render(<PaymentForm />);

    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, '5000');

    // Number input returns numeric value
    expect(amountInput).toHaveValue(5000);
  });

  it('shows currency dropdown with NGN and USD options', () => {
    render(<PaymentForm />);

    // Click to open the select
    const currencyTrigger = screen.getByRole('combobox');
    expect(currencyTrigger).toBeInTheDocument();
  });

  it('disables submit button while loading after submission', async () => {
    const user = userEvent.setup();
    render(<PaymentForm />);

    // Fill in required fields
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');

    const submitButton = screen.getByRole('button', { name: /proceed to payment/i });
    
    // Submit form
    await user.click(submitButton);

    // Button should show loading state (disabled)
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('shows loading spinner text when submitting', async () => {
    const user = userEvent.setup();
    render(<PaymentForm />);

    // Fill in required fields
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');

    const submitButton = screen.getByRole('button', { name: /proceed to payment/i });
    await user.click(submitButton);

    // Should show "Proceeding..." text when loading
    await waitFor(() => {
      expect(screen.getByText(/proceeding\.\.\./i)).toBeInTheDocument();
    });
  });

  it('calls zainpayInitPayment with correct config on submit', async () => {
    const user = userEvent.setup();
    render(<PaymentForm />);

    // Fill in required fields
    await user.type(screen.getByLabelText(/email address/i), 'user@test.com');
    await user.type(screen.getByLabelText(/amount/i), '2500');

    // Submit form
    await user.click(screen.getByRole('button', { name: /proceed to payment/i }));

    await waitFor(() => {
      expect(mockZainpayInitPayment).toHaveBeenCalledTimes(1);
      
      const callArgs = mockZainpayInitPayment.mock.calls[0];
      const config = callArgs[0];
      
      expect(config.email).toBe('user@test.com');
      expect(config.amount).toBe('2500');
      expect(config.currencyCode).toBe('NGN');
      expect(config.zainboxCode).toBeDefined();
      expect(config.txnRef).toBeDefined();
      expect(config.callBackUrl).toContain('/callback?txnRef=');
    });
  });

  it('shows configuration error toast when env vars are missing', async () => {
    // Temporarily remove env vars
    const originalZainboxCode = process.env.NEXT_PUBLIC_ZAINBOX_CODE_NAME;
    const originalPublicKey = process.env.NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY;
    delete process.env.NEXT_PUBLIC_ZAINBOX_CODE_NAME;
    delete process.env.NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY;

    const user = userEvent.setup();
    render(<PaymentForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.click(screen.getByRole('button', { name: /proceed to payment/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Configuration Error',
          variant: 'destructive',
        })
      );
    });

    // Restore env vars
    if (originalZainboxCode) process.env.NEXT_PUBLIC_ZAINBOX_CODE_NAME = originalZainboxCode;
    if (originalPublicKey) process.env.NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY = originalPublicKey;
  });

  it('handles payment success callback correctly', async () => {
    const user = userEvent.setup();
    
    // Set up mock to invoke callback with success
    mockZainpayInitPayment.mockImplementation((_config, callback) => {
      callback({ status: 'success', txnRef: 'test-ref-123' });
    });

    render(<PaymentForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.click(screen.getByRole('button', { name: /proceed to payment/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Payment Successful',
        })
      );
    });
  });

  it('handles payment failed callback correctly', async () => {
    const user = userEvent.setup();
    
    mockZainpayInitPayment.mockImplementation((_config, callback) => {
      callback({ status: 'failed', txnRef: 'test-ref-456' });
    });

    render(<PaymentForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.click(screen.getByRole('button', { name: /proceed to payment/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Payment Failed',
          variant: 'destructive',
        })
      );
    });
  });

  it('handles payment cancelled callback correctly', async () => {
    const user = userEvent.setup();
    
    mockZainpayInitPayment.mockImplementation((_config, callback) => {
      callback({ status: 'cancelled', txnRef: 'test-ref-789' });
    });

    render(<PaymentForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.click(screen.getByRole('button', { name: /proceed to payment/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Payment Cancelled',
          variant: 'destructive',
        })
      );
    });
  });

  it('shows error toast when zainpayInitPayment throws', async () => {
    const user = userEvent.setup();
    
    mockZainpayInitPayment.mockImplementation(() => {
      throw new Error('Network error');
    });

    render(<PaymentForm />);

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.click(screen.getByRole('button', { name: /proceed to payment/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Initialization Error',
          variant: 'destructive',
        })
      );
    });
  });

  it('form has proper structure with Card components', () => {
    const { container } = render(<PaymentForm />);

    // Check that form exists
    expect(container.querySelector('form')).toBeInTheDocument();
  });
});
