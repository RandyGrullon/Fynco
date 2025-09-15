import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Wallet } from "lucide-react";
import Link from "next/link";
import { AppSidebar } from "./app-sidebar";
import { UserNav } from "../user-nav";
import { ThemeToggle } from "../theme-toggle";
import { Switch } from "@/components/ui/switch";
import { useAmountVisibility } from "@/contexts/amount-visibility-context";

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const { hideAmounts, setHideAmounts } = useAmountVisibility();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex-1">
        {/* Can add breadcrumbs or page title here */}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Ocultar montos
          </span>
          <Switch checked={hideAmounts} onCheckedChange={setHideAmounts} />
        </div>
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}
