'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from './data-table-column-header';
import { DataTableRowActions } from './data-table-row-actions';
import { cn } from '@/lib/utils';
import {
  Utensils,
  Car,
  ShoppingCart,
  Receipt,
  Clapperboard,
  TrendingUp,
  TrendingDown,
  FileQuestion,
} from 'lucide-react';
import type { Transaction } from '@/lib/transactions';
import { format } from 'date-fns';

const categoryIcons: Record<Transaction['category'], React.ElementType> = {
  Food: Utensils,
  Transport: Car,
  Shopping: ShoppingCart,
  Utilities: Receipt,
  Entertainment: Clapperboard,
  Salary: TrendingUp,
  Other: FileQuestion,
};

export const columns = (refreshData: () => void): ColumnDef<Transaction>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => {
      const category = row.original.category;
      const Icon = categoryIcons[category] || Receipt;
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[200px] truncate font-medium">
            {row.getValue('source')}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => {
      return (
        <Badge variant="outline">{row.getValue('category')}</Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span>
        {format(new Date(row.getValue('date')), 'PPP')}
      </span>
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'));
      const type = row.original.type;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);

      return (
        <div
          className={cn(
            'font-medium',
            type === 'income' ? 'text-green-600' : 'text-slate-800'
          )}
        >
          {type === 'income' ? '+' : '-'}
          {formatted}
        </div>
      );
    },
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type: 'income' | 'expense' = row.getValue('type');
      const Icon = type === 'income' ? TrendingUp : TrendingDown;
      return (
        <div className="flex items-center gap-2 capitalize">
          <Icon className={cn("h-4 w-4", type === 'income' ? 'text-green-500' : 'text-red-500')} />
          {type}
        </div>
      );
    },
     filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <DataTableRowActions row={row} refreshData={refreshData} />,
  },
];
