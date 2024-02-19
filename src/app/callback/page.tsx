import Link from "next/link";
import { Suspense } from "react";
import { verifyTransaction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import IncompleteVerification from "@/components/IncompleteVerification";

async function VerificationResult({ txnRef }: { txnRef: string }) {
  const result = await verifyTransaction(txnRef);

  if (result.status === "error") {
    return (
      <CardHeader className="items-center text-center">
        <XCircle className="w-16 h-16 text-destructive" />
        <CardTitle className="font-headline pt-4">Verification Failed</CardTitle>
        <CardDescription>{result.message}</CardDescription>
      </CardHeader>
    );
  }

  // Type guard to ensure data exists
  if (!('data' in result) || !result.data) {
    return <IncompleteVerification />;
  }

  const transaction = result.data;

  if (!transaction?.status) {
    return <IncompleteVerification />;
  }

  const status = transaction.status;

  const statusIcons = {
    Successful: <CheckCircle2 className="w-16 h-16 text-green-500" />,
    Failed: <XCircle className="w-16 h-16 text-destructive" />,
    Pending: <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />,
  };

  const statusDescriptions = {
    Successful: "Your payment was completed successfully.",
    Failed: "Your payment could not be processed.",
    Pending: "Your payment is currently being processed.",
  };

  const amount = parseFloat(transaction.amount);
  const displayAmount = !isNaN(amount)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: transaction.source?.split(" ")[0] || "NGN",
      }).format(amount)
    : "N/A";

  const createdAtDate = new Date(transaction.createdAt);
  const displayDate = !isNaN(createdAtDate.getTime())
    ? createdAtDate.toLocaleString()
    : "N/A";

  return (
    <>
      <CardHeader className="items-center text-center">
        {statusIcons[status as keyof typeof statusIcons] || (
          <AlertTriangle className="w-16 h-16 text-muted-foreground" />
        )}
        <CardTitle className="font-headline text-2xl pt-4">
          Transaction {status}
        </CardTitle>
        <CardDescription>
          {statusDescriptions[status as keyof typeof statusDescriptions] ||
            "Could not determine transaction status."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{displayAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-medium">
              {transaction.paymentMethod || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-medium">
              {transaction.transactionRef || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{displayDate}</span>
          </div>
        </div>
        <Separator />
      </CardContent>
    </>
  );
}

function VerificationSkeleton() {
  return (
    <>
      <CardHeader className="items-center">
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="h-8 w-48 mt-4" />
        <Skeleton className="h-5 w-64 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Separator />
      </CardContent>
    </>
  );
}

export default function CallbackPage({
  searchParams,
}: {
  searchParams: { txnRef?: string };
}) {
  const txnRef = searchParams.txnRef;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        {!txnRef ? (
          <CardHeader className="items-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500" />
            <CardTitle>Missing Information</CardTitle>
            <CardDescription>
              No transaction reference was provided.
            </CardDescription>
          </CardHeader>
        ) : (
          <Suspense fallback={<VerificationSkeleton />}>
            <VerificationResult txnRef={txnRef} />
          </Suspense>
        )}
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
