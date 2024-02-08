import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, CreditCard, List } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Welcome to the Zainpay Integration Kit
        </h1>
        <p className="text-muted-foreground">
          Build seamless payment experiences with our simple and robust APIs.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Building2 className="h-6 w-6 text-primary" />
              Zainbox Management
            </CardTitle>
            <CardDescription>
              Create and manage Zainboxes, your virtual buckets for receiving payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>
              A Zainbox allows you to create unlimited virtual accounts for easy payment tracking and reconciliation.
            </p>
            <Link href="/dashboard/zainbox/create" passHref>
              <Button className="w-full">
                Create a Zainbox <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <List className="h-6 w-6 text-accent" />
              Virtual Accounts
            </CardTitle>
            <CardDescription>
              View your existing Zainboxes and their associated virtual accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>
              Get a consolidated view of all your payment collections and manage your funds effectively.
            </p>
            <Link href="/dashboard/zainbox/list" passHref>
              <Button variant="secondary" className="w-full">
                View Zainboxes <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <CreditCard className="h-6 w-6 text-destructive" />
              Payment Processing
            </CardTitle>
            <CardDescription>
              Test the payment flow by initiating a sample transaction.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>
              Learn how to accept bank payments and integrate products with our flexible APIs.
            </p>
            <Link href="/dashboard/payment" passHref>
              <Button variant="outline" className="w-full">
                Make a Payment <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
