"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, FileSpreadsheet, FileJson } from "lucide-react";
import { StatisticsSummary } from "@/lib/statistics";
import { Transaction } from "@/lib/transactions";
import { Account } from "@/lib/accounts";
import { RecurringTransactionWithAccount } from "@/lib/recurring-transactions";
import {
  StatisticsExporter,
  ExportOptions,
} from "@/lib/statistics-exporter";

interface ExportDialogProps {
  summary: StatisticsSummary;
  transactions: Transaction[];
  accounts: Account[];
  recurringTransactions: RecurringTransactionWithAccount[];
}

export function ExportDialog({
  summary,
  transactions,
  accounts,
  recurringTransactions,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"json" | "csv" | "txt">("csv");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeTransactions, setIncludeTransactions] = useState(false);
  const [includeAccounts, setIncludeAccounts] = useState(false);
  const [includeRecurring, setIncludeRecurring] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const options: ExportOptions = {
        format,
        includeSummary,
        includeTransactions,
        includeAccounts,
        includeRecurring,
      };

      StatisticsExporter.exportAndDownload(
        summary,
        transactions,
        accounts,
        recurringTransactions,
        options
      );
      
      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "json":
        return <FileJson className="h-4 w-4" />;
      case "csv":
        return <FileSpreadsheet className="h-4 w-4" />;
      case "txt":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case "json":
        return "Machine-readable format for data processing";
      case "csv":
        return "Spreadsheet format for Excel or Google Sheets";
      case "txt":
        return "Human-readable text format for reports";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Financial Data</DialogTitle>
          <DialogDescription>
            Choose the format and data to include in your export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Export Format</Label>
            <Select
              value={format}
              onValueChange={(value: "json" | "csv" | "txt") => setFormat(value)}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {getFormatIcon(format)}
                    {format.toUpperCase()}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Spreadsheet)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON (Data)
                  </div>
                </SelectItem>
                <SelectItem value="txt">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    TXT (Report)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getFormatDescription(format)}
            </p>
          </div>

          {/* Data Inclusion Options */}
          <div className="space-y-3">
            <Label>Include Data</Label>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="summary"
                  checked={includeSummary}
                  onCheckedChange={(checked) => setIncludeSummary(!!checked)}
                />
                <Label htmlFor="summary" className="text-sm font-normal">
                  Financial Summary & Statistics
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transactions"
                  checked={includeTransactions}
                  onCheckedChange={(checked) => setIncludeTransactions(!!checked)}
                />
                <Label htmlFor="transactions" className="text-sm font-normal">
                  All Transactions ({transactions.length} items)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accounts"
                  checked={includeAccounts}
                  onCheckedChange={(checked) => setIncludeAccounts(!!checked)}
                />
                <Label htmlFor="accounts" className="text-sm font-normal">
                  Account Details ({accounts.length} accounts)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={includeRecurring}
                  onCheckedChange={(checked) => setIncludeRecurring(!!checked)}
                />
                <Label htmlFor="recurring" className="text-sm font-normal">
                  Recurring Transactions ({recurringTransactions.length} items)
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              isExporting ||
              (!includeSummary &&
                !includeTransactions &&
                !includeAccounts &&
                !includeRecurring)
            }
          >
            {isExporting ? (
              <>
                <Download className="h-4 w-4 mr-2 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
