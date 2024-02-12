'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ZainpayResponse {
  status: 'success' | 'failed' | 'cancelled';
  txnRef: string;
}

declare function zainpayInitPayment(
  config: any,
  callback: (response: ZainpayResponse) => void,
  publicKey: string
): void;

export default function PaymentForm() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://sandbox.zainpay.ng/v1/zainpay-inline.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const zainboxCode = process.env.NEXT_PUBLIC_ZAINBOX_CODE_NAME;
    const publicKey = process.env.NEXT_PUBLIC_ZAINPAY_PUBLIC_KEY;
    const txnRef = `zkit-${Date.now()}`;

    if (!zainboxCode || !publicKey) {
      toast({
        title: 'Configuration Error',
        description:
          'Zainbox code or public key is not defined. Please check your environment variables.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const paymentConfig = {
      amount,
      email, // Corrected from emailAddress to email
      currencyCode: currency,
      zainboxCode,
      txnRef,
      callBackUrl: `${window.location.origin}/callback?txnRef=${txnRef}`,
    };

    const handleCallback = (response: ZainpayResponse) => {
      setLoading(false);
      if (response.status === 'success') {
        toast({
          title: 'Payment Successful',
          description: `Transaction reference: ${response.txnRef}`,
        });
        window.location.href = `/callback?txnRef=${response.txnRef}`;
      } else if (response.status === 'failed') {
        toast({
          title: 'Payment Failed',
          description: 'Please try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Payment Cancelled',
          description: 'You have cancelled the payment.',
          variant: 'destructive',
        });
      }
    };

    try {
      zainpayInitPayment(paymentConfig, handleCallback, publicKey);
    } catch (error) {
      console.error(error);
      setLoading(false);
      toast({
        title: 'Initialization Error',
        description: 'Failed to start the payment process. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='flex justify-center items-start pt-10'>
      <form onSubmit={handleSubmit} className='w-full max-w-md'>
        <Card>
          <CardHeader>
            <CardTitle className='font-headline'>Make a Payment</CardTitle>
            <CardDescription>
              Enter payment details below. The payment will be processed securely
              by Zainpay.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email Address</Label>
              <Input
                id='email'
                name='email'
                type='email'
                placeholder='you@example.com'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='amount'>Amount</Label>
                <Input
                  id='amount'
                  name='amount'
                  type='number'
                  placeholder='1000'
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='currency'>Currency</Label>
                <Select
                  name='currency'
                  defaultValue='NGN'
                  onValueChange={setCurrency}
                >
                  <SelectTrigger id='currency'>
                    <SelectValue placeholder='Select currency' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='NGN'>NGN</SelectItem>
                    <SelectItem value='USD'>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type='submit' disabled={loading} className='w-full'>
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Proceeding...
                </>
              ) : (
                <>
                  Proceed to Payment <ArrowRight className='ml-2 h-4 w-4' />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
