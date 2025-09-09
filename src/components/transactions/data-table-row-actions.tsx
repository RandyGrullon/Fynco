"use client";

import { MoreHorizontal, Pen, Trash } from "lucide-react";
import { Row } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteTransaction, Transaction } from "@/lib/transactions";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { AddTransactionDialog } from "../add-transaction-dialog";

interface DataTableRowActionsProps<TData extends Transaction> {
  row: Row<TData>;
  refreshData: () => void;
}

export function DataTableRowActions<TData extends Transaction>({
  row,
  refreshData,
}: DataTableRowActionsProps<TData>) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (!user || !row.original.id) return;
    const result = await deleteTransaction(row.original.id, user.uid);
    if (result.success) {
      toast({
        title: "Transaction Deleted",
        description: "The transaction has been successfully deleted.",
        className: "bg-accent text-accent-foreground",
      });
      refreshData();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete transaction: ${result.error}`,
      });
    }
  };

  const transaction = row.original;

  return (
    <AlertDialog>
      <AddTransactionDialog
        open={isEditDialogOpen}
        setOpen={setIsEditDialogOpen}
        onTransactionAdded={refreshData}
        transaction={transaction}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
            <Pen className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash className="mr-2 h-3.5 w-3.5 text-destructive/70" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            transaction from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
