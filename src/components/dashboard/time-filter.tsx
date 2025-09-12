import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations();
  const periodLabels: Record<TimeFilterPeriod, string> = {
    daily: t('timeFilter.daily'),
    weekly: t('timeFilter.weekly'),
    monthly: t('timeFilter.monthly'),
    quarterly: t('timeFilter.quarterly'),
    yearly: t('timeFilter.yearly'),
    all: t('timeFilter.all'),
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
          {t('timeFilter.daily')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("weekly")}>
          {t('timeFilter.weekly')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("monthly")}>
          {t('timeFilter.monthly')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("quarterly")}>
          {t('timeFilter.quarterly')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("yearly")}>
          {t('timeFilter.yearly')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPeriodChange("all")}>
          {t('timeFilter.all')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
