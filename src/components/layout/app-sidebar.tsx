"use client";

import Link from "next/link";
import {
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  Settings,
  Repeat,
  BarChart3,
  Target,
  Activity,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/accounts", icon: Wallet, label: "Accounts" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { href: "/recurring", icon: Repeat, label: "Recurring" },
  { href: "/goals", icon: Target, label: "Goals" },
  { href: "/activity", icon: Activity, label: "Activity" },
  { href: "/statistics", icon: BarChart3, label: "Statistics" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  const handleLinkClick = () => {
    onNavigate?.();
  };

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-16 items-center border-b px-6 lg:h-[60px] lg:px-6">
        <Link
          href="/"
          onClick={handleLinkClick}
          className="flex items-center gap-3  font-headline font-semibold text-lg"
        >
          <img src="/logo.png" alt="Fynco" className="h-16  w-auto" />
          <span>Fynco</span>
        </Link>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-4 text-base font-medium lg:px-4 lg:text-sm">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-4 rounded-lg px-4 py-3 text-muted-foreground transition-all hover:text-primary lg:gap-3 lg:px-3 lg:py-2",
                  { "bg-muted text-primary": isActive }
                )}
              >
                <item.icon className="h-5 w-5 lg:h-4 lg:w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
