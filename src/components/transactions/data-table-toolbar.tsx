"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { AddExpenseDialog } from "../add-expense-dialog";

const transactionTypes = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

const transactionCategories = [
  { value: "Food", label: "Food" },
  { value: "Transport", label: "Transport" },
  { value: "Shopping", label: "Shopping" },
  { value: "Salary", label: "Salary" },
  { value: "Utilities", label: "Utilities" },
  { value: "Entertainment", label: "Entertainment" },
  { value: "Other", label: "Other" },
];

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  onRefresh: () => void;
}

export function DataTableToolbar<TData>({
  table,
  onRefresh,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-2">
      {/* Mobile Layout */}
      <div className="block md:hidden space-y-3">
        <Input
          placeholder="Search transactions..."
          value={(table.getColumn("source")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("source")?.setFilterValue(event.target.value)
          }
          className="h-10"
        />
        <div className="flex flex-wrap gap-2">
          {table.getColumn("type") && (
            <DataTableFacetedFilter
              column={table.getColumn("type")}
              title="Type"
              options={transactionTypes}
            />
          )}
          {table.getColumn("category") && (
            <DataTableFacetedFilter
              column={table.getColumn("category")}
              title="Category"
              options={transactionCategories}
            />
          )}
          {isFiltered && (
            <Button
              variant="outline"
              onClick={() => table.resetColumnFilters()}
              className="h-9 px-3"
              size="sm"
            >
              Clear filters
              <Cross2Icon className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Input
            placeholder="Filter transactions..."
            value={
              (table.getColumn("source")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table.getColumn("source")?.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
          {table.getColumn("type") && (
            <DataTableFacetedFilter
              column={table.getColumn("type")}
              title="Type"
              options={transactionTypes}
            />
          )}
          {table.getColumn("category") && (
            <DataTableFacetedFilter
              column={table.getColumn("category")}
              title="Category"
              options={transactionCategories}
            />
          )}
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => table.resetColumnFilters()}
              className="h-8 px-2 lg:px-3"
            >
              Reset
              <Cross2Icon className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <DataTableViewOptions table={table} />
        </div>
      </div>
    </div>
  );
}
