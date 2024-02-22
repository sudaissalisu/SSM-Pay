export const dynamic = 'force-dynamic';
import { listZainboxes } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle } from "lucide-react";

export default async function ListZainboxesPage() {
  const zainboxes = await listZainboxes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Your Zainboxes
        </h1>
        <p className="text-muted-foreground">
          A list of all the Zainboxes in your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Zainbox List</CardTitle>
          <CardDescription>
            {zainboxes.length > 0
              ? `Found ${zainboxes.length} Zainbox(es).`
              : "No Zainboxes found."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Auto Transfer</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zainboxes.length > 0 ? (
                zainboxes.map((zainbox) => (
                  <TableRow key={zainbox.codeName}>
                    <TableCell className="font-medium">{zainbox.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{zainbox.codeName}</Badge>
                    </TableCell>
                    <TableCell>
                      {zainbox.active ? (
                        <Badge>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" /> Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                       {zainbox.autoInternalTransfer ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(zainbox.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No Zainboxes found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
