"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect } from "react";
import { createZainbox } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
        </>
      ) : (
        <>
          Create Zainbox <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export default function ZainboxCreateForm() {
  const initialState = { message: '', errors: {} as Record<string, string[]> };
  const [state, dispatch] = useFormState(createZainbox, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.message && !state.errors) {
        if(state.data) {
             toast({
                title: "Success!",
                description: state.message,
            });
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: state.message,
            });
        }
    }
  }, [state, toast]);

  return (
    <form action={dispatch}>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Zainbox Details</CardTitle>
          <CardDescription>
            Fill in the details below to create your new Zainbox. Required fields are marked with *.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" placeholder="Example Merchant" required />
            {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="callbackUrl">Callback URL *</Label>
            <Input id="callbackUrl" name="callbackUrl" placeholder="https://example.com/callback" type="url" required />
             {state.errors?.callbackUrl && <p className="text-sm text-destructive">{state.errors.callbackUrl[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emailNotification">Email for Notifications</Label>
            <Input id="emailNotification" name="emailNotification" placeholder="notify@example.com" type="email" />
             {state.errors?.emailNotification && <p className="text-sm text-destructive">{state.errors.emailNotification[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="codeNamePrefix">Code Name Prefix (3 chars)</Label>
            <Input id="codeNamePrefix" name="codeNamePrefix" placeholder="EXM" maxLength={3} />
            {state.errors?.codeNamePrefix && <p className="text-sm text-destructive">{state.errors.codeNamePrefix[0]}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" placeholder="A brief description of this Zainbox" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" name="tags" placeholder="tag1, tag2, tag3" />
            <p className="text-xs text-muted-foreground">Comma-separated tags for organization.</p>
          </div>
           <div className="flex items-center space-x-4 rounded-md border p-4">
            <div className="flex-1 space-y-1">
                <p className="text-sm font-medium leading-none">
                    Enable Auto Internal Transfer
                </p>
                <p className="text-sm text-muted-foreground">
                    Automatically consolidate deposits into a single settlement account.
                </p>
            </div>
            <Switch id="allowAutoInternalTransfer" name="allowAutoInternalTransfer" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}
