"use client";

import Link from "next/link";
import {
  Wallet,
  LayoutDashboard,
  Settings,
  Repeat,
  BarChart3,
  Target,
  Activity,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "navigation.dashboard" },
  { href: "/accounts", icon: Wallet, labelKey: "navigation.accounts" },
  { href: "/recurring", icon: Repeat, labelKey: "navigation.recurring" },
  { href: "/goals", icon: Target, labelKey: "navigation.goals" },
  { href: "/activity", icon: Activity, labelKey: "navigation.activity" },
  { href: "/statistics", icon: BarChart3, labelKey: "navigation.statistics" },
  { href: "/settings", icon: Settings, labelKey: "navigation.settings" },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();

  // Better active detection - remove locale prefix and check path segments
  const getIsActive = (href: string) => {
    // Remove locale prefix (e.g., /en or /es) from pathname
    const cleanPathname = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
    
    // For root dashboard, check exact match or if we're on root
    if (href === '/dashboard') {
      return cleanPathname === '/dashboard' || cleanPathname === '/';
    }
    
    // For other routes, check if the clean pathname starts with the href
    return cleanPathname.startsWith(href) && cleanPathname !== '/';
  };

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
          <span>{t('app.title')}</span>
        </Link>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-4 text-base font-medium lg:px-4 lg:text-sm">
          {navItems.map((item) => {
            const isActive = getIsActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-4 rounded-lg px-4 py-3 transition-all duration-200 lg:gap-3 lg:px-3 lg:py-2",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold shadow-sm" 
                    : "text-muted-foreground hover:text-primary hover:bg-accent/50"
                )}
              >
                {/* Enhanced active indicator bar */}
                <span
                  className={cn(
                    "absolute left-0 top-1 bottom-1 w-1 rounded-r-full transition-all duration-200",
                    isActive 
                      ? "bg-primary shadow-sm" 
                      : "bg-transparent"
                  )}
                />
                {/* Icon with active state styling */}
                <item.icon 
                  className={cn(
                    "h-5 w-5 lg:h-4 lg:w-4 transition-colors duration-200",
                    isActive ? "text-primary" : ""
                  )} 
                />
                {/* Text with active indicator */}
                <span className="relative">
                  {t(item.labelKey)}
                  {isActive && (
                    <span className="absolute -right-2 top-0 h-1.5 w-1.5 bg-primary rounded-full"></span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
