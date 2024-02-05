"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ArrowLeftRight, Loader2 } from "lucide-react";
import { SSMLogo } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { getExchangeRate } from "@/app/actions";

function SubmitButton({ isSubmitting }: { isSubmitting: boolean }) {
  return (
    <Button type="submit" disabled={isSubmitting} className="w-full">
      {isSubmitting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Proceeding...
        </>
      ) : (
        <>
          Proceed to Payment <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export default function PaymentPage() {
  const [amount, setAmount] = useState("1000");
  const [currency, setCurrency] = useState("NGN");
  const [email, setEmail] = useState("test@example.com");
  const [mobileNumber, setMobileNumber] = useState("08012345678");
  const [convertedAmount, setConvertedAmount] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<{ buy: number; sell: number } | null>(null);
  const [isExchangeRatePending, startExchangeRateTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    getExchangeRate().then(setExchangeRate);
  }, []);

  const calculateConversion = useCallback(() => {
    if (!exchangeRate || !amount) {
      setConvertedAmount(null);
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
      setConvertedAmount(null);
      return;
    }

    let result: number;
    let resultCurrency: string;

    if (currency === "NGN") {
      result = numericAmount / exchangeRate.sell;
      resultCurrency = "USD";
    } else {
      result = numericAmount * exchangeRate.buy;
      resultCurrency = "NGN";
    }
    
    setConvertedAmount(
      `${result.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${resultCurrency}`
    );
  }, [amount, currency, exchangeRate]);

  useEffect(() => {
    startExchangeRateTransition(() => {
      calculateConversion();
    });
  }, [calculateConversion]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payment/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency, email, mobileNumber }),
      });

      const result = await response.json();

      if (response.ok && result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        throw new Error(result.error || "Payment initialization failed.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Payment Initialization Failed",
        description: (
          <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 max-h-[400px] overflow-y-auto">
            <code className="text-white whitespace-pre-wrap">{error.message}</code>
          </pre>
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-6">
        <SSMLogo className="size-8 text-primary" />
        <span className="text-2xl font-semibold font-headline text-primary">
          SSM Pay
        </span>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Make a Payment</CardTitle>
            <CardDescription>
              Enter payment details below. You will be redirected to our secure payment gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileNumber">Mobile Number</Label>
                <Input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  placeholder="08012345678"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select name="currency" value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
             <div className="flex items-center justify-center text-sm text-muted-foreground h-8">
              {isExchangeRatePending ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
              ) : convertedAmount ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>{convertedAmount}</span>
                </div>
              ) : null}
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton isSubmitting={isSubmitting} />
          </CardFooter>
        </Card>
        <p className="text-xs text-center text-muted-foreground mt-4">
          Exchange rates are updated in real-time.
        </p>
      </form>
    </div>
  );
}
