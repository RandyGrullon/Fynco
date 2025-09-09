import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export type TimeFilterPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "all";

interface TimeFilterProps {
  selectedPeriod: TimeFilterPeriod;
  onPeriodChange: (period: TimeFilterPeriod) => void;
}

export function TimeFilter({
  selectedPeriod,
  onPeriodChange,
}: TimeFilterProps) {
  const periodLabels: Record<TimeFilterPeriod, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
    all: "All Time",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-1">
          {periodLabels[selectedPeriod]}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPeriodChange("daily")}>
          Daily
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("weekly")}>
          Weekly
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("monthly")}>
          Monthly
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("quarterly")}>
          Quarterly
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("yearly")}>
          Yearly
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("all")}>
          All Time
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
