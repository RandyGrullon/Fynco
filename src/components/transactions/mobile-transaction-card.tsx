"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Utensils,
  Car,
  ShoppingCart,
  Receipt,
  Clapperboard,
  TrendingUp,
  TrendingDown,
  FileQuestion,
  Briefcase,
  Gift,
  Undo,
  MoreVertical,
  Edit,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/transactions";

const categoryIcons: Record<Transaction["category"], React.ElementType> = {
  Food: Utensils,
  Transport: Car,
  Shopping: ShoppingCart,
  Utilities: Receipt,
  Entertainment: Clapperboard,
  Salary: Briefcase,
  Investment: TrendingUp,
  Gift: Gift,
  Refund: Undo,
  Other: FileQuestion,
};

interface MobileTransactionCardProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

export function MobileTransactionCard({
  transaction,
  onEdit,
  onDelete,
}: MobileTransactionCardProps) {
  const Icon = categoryIcons[transaction.category] || Receipt;
  const amount = parseFloat(transaction.amount.toString());
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  const TypeIcon = transaction.type === "income" ? TrendingUp : TrendingDown;

  const formatDate = (date: Date | Timestamp | string) => {
    try {
      if (date instanceof Timestamp) {
        return format(date.toDate(), "MMM dd, yyyy");
      } else if (date instanceof Date) {
        return format(date, "MMM dd, yyyy");
      } else {
        return format(new Date(date), "MMM dd, yyyy");
      }
    } catch {
      return "Invalid date";
    }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  transaction.type === "income"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">
                  {transaction.source}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDate(transaction.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {transaction.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <TypeIcon
                    className={cn(
                      "h-3 w-3",
                      transaction.type === "income"
                        ? "text-green-500"
                        : "text-red-500"
                    )}
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {transaction.type}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "font-semibold text-sm",
                    transaction.type === "income"
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {transaction.type === "income" ? "+" : "-"}
                  {formatted}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(transaction)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(transaction)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
