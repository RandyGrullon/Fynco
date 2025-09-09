import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Transaction } from "@/lib/transactions";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";

interface RecentTransactionsProps {
  transactions: Transaction[];
  totalCount: number;
}

export function RecentTransactions({
  transactions,
  totalCount,
}: RecentTransactionsProps) {
  const { formatCurrency } = useCurrencyFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          You made {totalCount} transactions in total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <div className="space-y-8">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={`https://picsum.photos/seed/${transaction.source}/100`}
                    data-ai-hint="company logo"
                  />
                  <AvatarFallback>
                    {transaction.source.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {transaction.source}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(transaction.date as string), "PPP")}
                  </p>
                </div>
                <div className={cn("ml-auto font-medium")}>
                  <Badge
                    variant={
                      transaction.type === "income" ? "default" : "secondary"
                    }
                    className={cn(
                      transaction.type === "income"
                        ? "bg-accent text-accent-foreground"
                        : "bg-destructive/20 text-destructive"
                    )}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount).replace("-", "")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent transactions found. Add one to get started!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
