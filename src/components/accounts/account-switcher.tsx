"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, SwitchCamera } from "lucide-react";
import { Account } from "@/lib/accounts";
import { useRouter } from "next/navigation";

interface AccountSwitcherProps {
  currentAccount: Account;
  otherAccounts: Account[];
}

export function AccountSwitcher({
  currentAccount,
  otherAccounts,
}: AccountSwitcherProps) {
  const router = useRouter();

  const handleAccountSwitch = (accountId: string) => {
    router.push(`/accounts/${accountId}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <SwitchCamera className="h-4 w-4 mr-1" />
          Switch Account
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel>Switch to account</DropdownMenuLabel>

        <DropdownMenuItem disabled className="bg-accent/50">
          <div className="flex justify-between w-full items-center">
            <span className="font-medium">{currentAccount.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currentAccount.currency,
              }).format(currentAccount.balance)}
            </span>
          </div>
        </DropdownMenuItem>

        {otherAccounts.length > 0 && <DropdownMenuSeparator />}

        {otherAccounts.length > 0 ? (
          otherAccounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              onClick={() => handleAccountSwitch(account.id as string)}
              className="cursor-pointer"
            >
              <div className="flex justify-between w-full items-center">
                <span>{account.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: account.currency,
                  }).format(account.balance)}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>
            No other accounts available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
