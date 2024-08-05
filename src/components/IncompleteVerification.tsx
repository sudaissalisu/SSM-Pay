'use client';

import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function IncompleteVerification() {
  const router = useRouter();

  return (
    <>
      <CardHeader className="items-center text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <CardTitle className="font-headline pt-4">Verification Incomplete</CardTitle>
        <CardDescription>
          Could not retrieve complete transaction details. This may happen if the
          transaction is still processing.
        </CardDescription>
      </CardHeader>
      <CardContent>
          <Button onClick={() => router.refresh()} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Status
          </Button>
      </CardContent>
    </>
  );
}
